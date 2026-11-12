"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { communities, communityMembers, contactMessages, events, resourceVotes, resources, roadmapProgress, roadmaps } from "@/db/schema";
import { EVENT_TYPE_VALUES, RESOURCE_LEVELS, RESOURCE_TYPE_VALUES } from "@/lib/constants";
import { assessLink } from "@/lib/security/link-safety";
import { zBool, zCountry, zEmail, zHttpUrl, zId, zInline, zOneOf, zOptionalDateTime, zOptionalInline, zOptionalText, zText } from "@/lib/validation";
import { callAction, fail, formAction, isUniqueViolation, ok, publicFormAction } from "@/server/action-utils";
import { isValidCategory } from "@/server/queries/taxonomy";

export const toggleCommunityMembershipAction = callAction({ schema: z.object({ communityId: zId }), rateLimit: "follow" }, async ({ communityId }, { user }) => {
  const [community] = await db.select({ id: communities.id }).from(communities).where(eq(communities.id, communityId)).limit(1);
  if (!community) return fail("That community could not be found.");
  const bump = (delta: number) =>
    db.update(communities).set({ memberCount: sql`greatest(${communities.memberCount} + ${delta}, 0)` }).where(eq(communities.id, communityId));

  const removed = await db
    .delete(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, user.id)))
    .returning({ id: communityMembers.userId });
  if (removed.length > 0) {
    await bump(-1);
    return ok("You left the community.", { joined: false });
  }
  const added = await db.insert(communityMembers).values({ communityId, userId: user.id }).onConflictDoNothing().returning({ id: communityMembers.userId });
  if (added.length > 0) await bump(1);
  return ok("Welcome — you can now start discussions here.", { joined: true });
});

/** Rejects links our heuristics consider dangerous before they reach the moderation queue. */
function linkProblem(url: string): string | null {
  const assessment = assessLink(url);
  if (!assessment) return "Enter a full URL starting with https://";
  return assessment.level === "danger" ? `That link looks unsafe (${assessment.reasons[0]}).` : null;
}

const eventSchema = z.object({
  title: zInline(140, 4),
  type: zOneOf(EVENT_TYPE_VALUES),
  url: zHttpUrl,
  organizer: zOptionalInline(120),
  description: zOptionalText(1500),
  location: zOptionalInline(120),
  country: zCountry,
  isOnline: zBool,
  startsAt: zOptionalDateTime,
  endsAt: zOptionalDateTime,
});

export const submitEventAction = formAction({ schema: eventSchema, rateLimit: "submission" }, async (input, { user }) => {
  if (!input.startsAt) return fail("Add the start date.", { startsAt: "Enter the start date." });
  if (input.startsAt.getTime() < Date.now() - 86_400_000) return fail("This event has already started.", { startsAt: "Choose a future date." });
  if (input.endsAt && input.endsAt < input.startsAt) return fail("The end is before the start.", { endsAt: "Must be after the start." });
  const problem = linkProblem(input.url);
  if (problem) return fail(problem, { url: problem });
  await db.insert(events).values({
    title: input.title,
    type: input.type,
    url: input.url,
    organizer: input.organizer ?? null,
    description: input.description ?? null,
    location: input.location ?? null,
    country: input.country ?? null,
    isOnline: input.isOnline,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    submittedById: user.id,
  });
  return ok("Thanks — the event will be listed once a moderator has checked it.");
});

const resourceSchema = z.object({
  title: zInline(140, 4),
  url: zHttpUrl,
  description: zOptionalText(600),
  type: zOneOf(RESOURCE_TYPE_VALUES),
  category: zInline(60),
  level: zOneOf(RESOURCE_LEVELS),
  isFree: zBool,
});

export const submitResourceAction = formAction({ schema: resourceSchema, rateLimit: "submission" }, async (input, { user }) => {
  if (!(await isValidCategory(input.category))) return fail("Please choose a category.", { category: "Choose a category." });
  const problem = linkProblem(input.url);
  if (problem) return fail(problem, { url: problem });
  try {
    await db.insert(resources).values({ ...input, description: input.description ?? null, submittedById: user.id });
  } catch (err) {
    if (isUniqueViolation(err)) return fail("That resource has already been submitted.", { url: "Already submitted." });
    throw err;
  }
  return ok("Thanks — the resource will appear once a moderator has reviewed it.");
});

export const toggleResourceVoteAction = callAction({ schema: z.object({ resourceId: zId }), rateLimit: "reaction" }, async ({ resourceId }, { user }) => {
  const [resource] = await db.select({ id: resources.id }).from(resources).where(and(eq(resources.id, resourceId), eq(resources.status, "approved"))).limit(1);
  if (!resource) return fail("That resource is not available.");
  const bump = (delta: number) =>
    db.update(resources).set({ upvoteCount: sql`greatest(${resources.upvoteCount} + ${delta}, 0)` }).where(eq(resources.id, resourceId));
  const removed = await db.delete(resourceVotes).where(and(eq(resourceVotes.userId, user.id), eq(resourceVotes.resourceId, resourceId))).returning({ id: resourceVotes.resourceId });
  if (removed.length > 0) {
    await bump(-1);
    return ok(undefined, { voted: false });
  }
  const added = await db.insert(resourceVotes).values({ userId: user.id, resourceId }).onConflictDoNothing().returning({ id: resourceVotes.resourceId });
  if (added.length > 0) await bump(1);
  return ok(undefined, { voted: true });
});

export const toggleRoadmapStepAction = callAction(
  { schema: z.object({ roadmapId: zId, step: z.number().int().min(0).max(100) }), rateLimit: "generic" },
  async ({ roadmapId, step }, { user }) => {
    const [roadmap] = await db.select({ steps: roadmaps.steps }).from(roadmaps).where(eq(roadmaps.id, roadmapId)).limit(1);
    if (!roadmap || step >= roadmap.steps.length) return fail("That step could not be found.");
    const [current] = await db
      .select({ completedSteps: roadmapProgress.completedSteps })
      .from(roadmapProgress)
      .where(and(eq(roadmapProgress.userId, user.id), eq(roadmapProgress.roadmapId, roadmapId)))
      .limit(1);
    const done = new Set(current?.completedSteps ?? []);
    if (done.has(step)) done.delete(step);
    else done.add(step);
    const completedSteps = [...done].sort((a, b) => a - b);
    await db
      .insert(roadmapProgress)
      .values({ userId: user.id, roadmapId, completedSteps })
      .onConflictDoUpdate({ target: [roadmapProgress.userId, roadmapProgress.roadmapId], set: { completedSteps, updatedAt: new Date() } });
    return ok(undefined, { completedSteps });
  },
);

// ── Contact ──────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name: zInline(80, 2),
  email: zEmail,
  topic: zOneOf(["general", "support", "report", "partnership", "press", "privacy"] as const),
  message: zText(4000, 20),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(200).optional(),
});

export const contactAction = publicFormAction({ schema: contactSchema, rateLimit: "contact" }, async (input, { user }) => {
  if (input.website) return ok("Thanks — your message has been received.");
  await db.insert(contactMessages).values({ userId: user?.id ?? null, name: input.name, email: input.email, topic: input.topic, message: input.message });
  return ok("Thanks — your message has been received. We reply to the address you gave.");
});
