"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { achievements, categories, comments, companies, contactMessages, events, jobSources, jobs, messages, posts, reports, resources, users } from "@/db/schema";
import { assignableRoles, outranks } from "@/lib/auth/permissions";
import { revokeUserSessions } from "@/lib/auth/session";
import { invalidate } from "@/lib/cache";
import { JOB_SOURCE_KIND_VALUES, ROLES, SOURCE_AUTHORIZATION_BASES, type SourceAuthorizationBasis } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { parseHttpUrl } from "@/lib/security/link-safety";
import { slugify } from "@/lib/utils";
import { zBool, zId, zInline, zOneOf, zOptionalId, zOptionalInline, zOptionalInt, zOptionalText, zText } from "@/lib/validation";
import { callAction, fail, formAction, isUniqueViolation, ok } from "@/server/action-utils";
import { DEFAULT_LISTING_LIFETIME_MS, syncSource } from "@/server/services/job-sync";
import { notify } from "@/server/services/notify";
import { runScheduledWork } from "@/server/services/scheduled-work";

// ── Reports & content ────────────────────────────────────────────────────────

const resolveSchema = z.object({
  id: zId,
  outcome: zOneOf(["dismiss", "remove", "resolve"] as const),
  resolution: zOptionalText(500),
});

/**
 * Closes a report. `remove` also takes the reported item down (posts, comments and messages
 * are removed, job listings rejected); every other open report on the same item is closed with it.
 */
export const resolveReportAction = formAction({ schema: resolveSchema, capability: "moderate:content" }, async (input, { user }) => {
  const [report] = await db.select().from(reports).where(and(eq(reports.id, input.id), eq(reports.status, "open"))).limit(1);
  if (!report) return fail("That report has already been handled.");
  const { targetType, targetId } = report;

  if (input.outcome === "remove") {
    if (targetType === "post") {
      const [post] = await db.update(posts).set({ status: "removed" }).where(eq(posts.id, targetId)).returning({ authorId: posts.authorId });
      if (post) await notify({ userId: post.authorId, type: "system", entityType: "post", entityId: targetId, data: { title: "One of your posts was removed", preview: input.resolution ?? "It did not follow the community guidelines.", href: "/terms" } });
      invalidate("feed:");
    } else if (targetType === "comment") {
      const [comment] = await db.update(comments).set({ status: "removed" }).where(eq(comments.id, targetId)).returning({ postId: comments.postId });
      if (comment) await db.update(posts).set({ commentCount: db.$count(comments, and(eq(comments.postId, comment.postId), eq(comments.status, "published"))) }).where(eq(posts.id, comment.postId));
    } else if (targetType === "message") {
      await db.update(messages).set({ body: "[This message was removed by a moderator]" }).where(eq(messages.id, targetId));
    } else if (targetType === "job") {
      await db.update(jobs).set({ status: "rejected", closedAt: new Date(), closedReason: "Removed after a report", reviewNote: input.resolution ?? "Removed after a report" }).where(eq(jobs.id, targetId));
      revalidatePath("/jobs");
    } else {
      return fail("Members and organisations are actioned from their own admin pages. Resolve this report once you have done so.");
    }
  } else if (input.outcome === "dismiss") {
    // Restore anything that was hidden automatically while the reports were pending.
    if (targetType === "post") await db.update(posts).set({ status: "published" }).where(and(eq(posts.id, targetId), eq(posts.status, "hidden")));
    if (targetType === "comment") await db.update(comments).set({ status: "published" }).where(and(eq(comments.id, targetId), eq(comments.status, "hidden")));
  }

  await db
    .update(reports)
    .set({ status: input.outcome === "dismiss" ? "dismissed" : "resolved", resolution: input.resolution ?? null, resolvedById: user.id, resolvedAt: new Date() })
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open")));
  await audit(`moderation.report_${input.outcome}`, { actorId: user.id, targetType, targetId, metadata: { reportId: report.id, reason: report.reason } });
  return ok(input.outcome === "remove" ? "Content removed and report closed." : input.outcome === "dismiss" ? "Report dismissed." : "Report resolved.");
});

export const setPostStatusAction = callAction(
  { schema: z.object({ id: zId, status: zOneOf(["published", "removed"] as const) }), capability: "moderate:content" },
  async ({ id, status }, { user }) => {
    const updated = await db.update(posts).set({ status, flaggedReason: status === "published" ? null : undefined }).where(eq(posts.id, id)).returning({ id: posts.id });
    if (updated.length === 0) return fail("That post could not be found.");
    await audit(`moderation.post_${status}`, { actorId: user.id, targetType: "post", targetId: id });
    invalidate("feed:");
    return ok(status === "removed" ? "Post removed." : "Post approved.");
  },
);

// ── Members ──────────────────────────────────────────────────────────────────

const userStatusSchema = z.object({ userId: zId, status: zOneOf(["active", "suspended"] as const), reason: zOptionalText(500) });

export const setUserStatusAction = formAction({ schema: userStatusSchema, capability: "manage:users" }, async (input, { user }) => {
  if (input.userId === user.id) return fail("You cannot change your own account status.");
  const [target] = await db.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target || target.status === "deleted") return fail("That account could not be found.");
  if (!outranks(user.role, target.role)) return fail("You can only act on accounts with a lower role than yours.");
  if (input.status === "suspended" && !input.reason) return fail("Give a reason for the suspension.", { reason: "Required." });

  await db.update(users).set({ status: input.status, statusReason: input.status === "suspended" ? (input.reason ?? null) : null }).where(eq(users.id, input.userId));
  if (input.status === "suspended") await revokeUserSessions(input.userId);
  await audit(`admin.user_${input.status === "suspended" ? "suspended" : "reactivated"}`, { actorId: user.id, targetType: "user", targetId: input.userId, metadata: { reason: input.reason } });
  return ok(input.status === "suspended" ? "Account suspended and signed out everywhere." : "Account reactivated.");
});

export const setUserRoleAction = formAction({ schema: z.object({ userId: zId, role: zOneOf(ROLES) }), capability: "manage:roles" }, async (input, { user }) => {
  if (input.userId === user.id) return fail("You cannot change your own role.");
  if (!assignableRoles(user.role).includes(input.role)) return fail("You cannot assign that role.");
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) return fail("That account could not be found.");
  if (!outranks(user.role, target.role)) return fail("You can only act on accounts with a lower role than yours.");
  await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
  // Privileges changed: force a fresh sign-in so no session carries the old role.
  await revokeUserSessions(input.userId);
  await audit("admin.role_changed", { actorId: user.id, targetType: "user", targetId: input.userId, metadata: { from: target.role, to: input.role } });
  return ok("Role updated.");
});

// ── Verification ─────────────────────────────────────────────────────────────

const decisionSchema = z.object({ id: zId, decision: zOneOf(["verify", "reject", "revoke"] as const), note: zOptionalText(500) });

export const reviewCompanyVerificationAction = formAction({ schema: decisionSchema, capability: "verify:companies" }, async (input, { user }) => {
  const [company] = await db.select().from(companies).where(eq(companies.id, input.id)).limit(1);
  if (!company) return fail("That organisation could not be found.");
  if (input.decision !== "verify" && !input.note) return fail("Explain the decision so the organisation knows what to fix.", { note: "Required." });
  const verified = input.decision === "verify";
  await db
    .update(companies)
    .set({
      verificationStatus: verified ? "verified" : input.decision === "reject" ? "rejected" : "unverified",
      verificationNote: input.note ?? null,
      verifiedAt: verified ? new Date() : null,
      verifiedById: verified ? user.id : null,
    })
    .where(eq(companies.id, company.id));
  await audit(`admin.company_${input.decision}`, { actorId: user.id, targetType: "company", targetId: company.id, metadata: { note: input.note } });
  if (company.createdById) {
    await notify({
      userId: company.createdById,
      type: "system",
      entityType: "company",
      entityId: company.id,
      data: {
        title: verified ? `${company.name} is now verified` : `Verification update for ${company.name}`,
        preview: verified ? "The verified badge now appears on the organisation page and its job listings." : (input.note ?? undefined),
        href: `/recruiter/${company.slug}`,
      },
    });
  }
  revalidatePath(`/companies/${company.slug}`);
  return ok(verified ? "Organisation verified." : "Decision recorded.");
});

export const setCompanyStatusAction = callAction(
  { schema: z.object({ id: zId, status: zOneOf(["active", "suspended"] as const) }), capability: "verify:companies" },
  async ({ id, status }, { user }) => {
    const [company] = await db.update(companies).set({ status }).where(eq(companies.id, id)).returning({ slug: companies.slug });
    if (!company) return fail("That organisation could not be found.");
    if (status === "suspended") {
      await db.update(jobs).set({ status: "closed", closedAt: new Date(), closedReason: "Organisation suspended" }).where(and(eq(jobs.companyId, id), inArray(jobs.status, ["active", "pending_review"])));
    }
    await audit(`admin.company_${status}`, { actorId: user.id, targetType: "company", targetId: id });
    revalidatePath(`/companies/${company.slug}`);
    return ok(status === "suspended" ? "Organisation suspended and its open listings closed." : "Organisation reactivated.");
  },
);

export const reviewAchievementAction = formAction({ schema: decisionSchema, capability: "verify:achievements" }, async (input, { user }) => {
  const [achievement] = await db.select().from(achievements).where(eq(achievements.id, input.id)).limit(1);
  if (!achievement) return fail("That achievement could not be found.");
  if (achievement.userId === user.id) return fail("You cannot review your own achievement.");
  if (input.decision !== "verify" && !input.note) return fail("Explain the decision.", { note: "Required." });
  const verified = input.decision === "verify";
  await db
    .update(achievements)
    .set({
      verificationStatus: verified ? "verified" : input.decision === "reject" ? "rejected" : "unverified",
      verificationNote: input.note ?? null,
      verifiedAt: verified ? new Date() : null,
      verifiedById: verified ? user.id : null,
    })
    .where(eq(achievements.id, achievement.id));
  await audit(`admin.achievement_${input.decision}`, { actorId: user.id, targetType: "achievement", targetId: achievement.id });
  await notify({
    userId: achievement.userId,
    type: "achievement",
    entityType: "achievement",
    entityId: achievement.id,
    data: {
      title: verified ? `Verified: ${achievement.title}` : `Review outcome: ${achievement.title}`,
      preview: verified ? "A moderator checked your evidence. The achievement now shows as verified." : (input.note ?? undefined),
      href: "/achievements",
    },
  });
  return ok(verified ? "Achievement verified." : "Decision recorded.");
});

// ── Job review queue ─────────────────────────────────────────────────────────

const jobReviewSchema = z.object({ id: zId, decision: zOneOf(["approve", "reject"] as const), note: zOptionalText(500) });

export const reviewJobAction = formAction({ schema: jobReviewSchema, capability: "moderate:jobs" }, async (input, { user }) => {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1);
  if (!job) return fail("That listing could not be found.");
  if (input.decision === "reject" && !input.note) return fail("Give a reason for rejecting the listing.", { note: "Required." });
  const now = new Date();
  if (input.decision === "approve") {
    if (job.applyMode === "external" && !(job.applyUrl && parseHttpUrl(job.applyUrl))) return fail("This listing has no valid application link and cannot be published.");
    await db
      .update(jobs)
      .set({ status: "active", reviewNote: null, lastVerifiedAt: now, closedAt: null, closedReason: null, expiresAt: job.expiresAt && job.expiresAt > now ? job.expiresAt : new Date(now.getTime() + DEFAULT_LISTING_LIFETIME_MS) })
      .where(eq(jobs.id, job.id));
  } else {
    await db.update(jobs).set({ status: "rejected", reviewNote: input.note ?? null, closedAt: now, closedReason: "Rejected in review" }).where(eq(jobs.id, job.id));
  }
  await audit(`admin.job_${input.decision}`, { actorId: user.id, targetType: "job", targetId: job.id, metadata: { source: job.source, note: input.note } });
  if (job.postedById) {
    await notify({
      userId: job.postedById,
      type: "system",
      entityType: "job",
      entityId: job.id,
      data: {
        title: input.decision === "approve" ? `Your listing is live: ${job.title}` : `Your listing was not published: ${job.title}`,
        preview: input.decision === "approve" ? undefined : (input.note ?? undefined),
        href: input.decision === "approve" ? `/jobs/${job.slug}` : "/terms",
      },
    });
  }
  revalidatePath("/jobs");
  return ok(input.decision === "approve" ? "Listing published." : "Listing rejected.");
});

// ── Job sources ──────────────────────────────────────────────────────────────

const sourceSchema = z.object({
  id: zOptionalId,
  name: zInline(100, 2),
  kind: zOneOf(JOB_SOURCE_KIND_VALUES),
  target: zInline(500, 2),
  companyName: zInline(120, 2),
  companySlug: zOptionalInline(80),
  authorizationBasis: zOneOf(SOURCE_AUTHORIZATION_BASES.map((b) => b.value) as [SourceAuthorizationBasis, ...SourceAuthorizationBasis[]]),
  authorizationNote: zText(1000, 10),
  enabled: zBool,
  autoPublish: zBool,
  securityOnly: zBool,
  intervalHours: zOptionalInt(1, 168),
});

export const saveJobSourceAction = formAction({ schema: sourceSchema, capability: "manage:sources" }, async (input, { user }) => {
  const isFeed = input.kind === "json_feed" || input.kind === "rss";
  if (isFeed) {
    const url = parseHttpUrl(input.target);
    if (!url || url.protocol !== "https:") return fail("Feeds must be HTTPS URLs.", { target: "Enter an https:// URL." });
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(input.target)) {
    return fail("That does not look like a board identifier.", { target: "Use the board token only, not the full URL." });
  }

  let companyId: string | null = null;
  if (input.companySlug) {
    const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slugify(input.companySlug))).limit(1);
    if (!company) return fail("No organisation page has that slug.", { companySlug: "Not found." });
    companyId = company.id;
  }
  const { id, companySlug: _slug, intervalHours, ...fields } = input;
  const row = { ...fields, companyId, intervalHours: intervalHours ?? 24 };
  try {
    if (id) {
      const updated = await db.update(jobSources).set(row).where(eq(jobSources.id, id)).returning({ id: jobSources.id });
      if (updated.length === 0) return fail("That source could not be found.");
    } else {
      await db.insert(jobSources).values({ ...row, createdById: user.id, nextSyncAt: new Date() });
    }
  } catch (err) {
    if (isUniqueViolation(err)) return fail("That source is already configured.", { target: "Already configured." });
    throw err;
  }
  await audit(id ? "admin.source_updated" : "admin.source_created", { actorId: user.id, targetType: "job_source", targetId: id, metadata: { kind: input.kind, target: input.target, basis: input.authorizationBasis } });
  return ok(id ? "Source saved." : "Source added. It will synchronise on the next run, or use Sync now.");
});

export const syncSourceNowAction = callAction({ schema: z.object({ id: zId }), capability: "manage:sources", rateLimit: "generic" }, async ({ id }, { user }) => {
  const report = await syncSource(id, "manual");
  await audit("admin.source_synced", { actorId: user.id, targetType: "job_source", targetId: id, metadata: { status: report.status, created: report.created } });
  if (report.status === "failed") return fail(`Sync failed: ${report.error ?? "unknown error"}`);
  return ok(`Sync finished: ${report.created} new, ${report.updated} updated, ${report.expired} closed, ${report.skipped} skipped.`);
});

export const deleteJobSourceAction = callAction({ schema: z.object({ id: zId }), capability: "manage:sources" }, async ({ id }, { user }) => {
  // Listings from a removed source can no longer be verified, so they are closed with it.
  await db.update(jobs).set({ status: "expired", closedAt: new Date(), closedReason: "Source removed" }).where(and(eq(jobs.sourceId, id), inArray(jobs.status, ["active", "pending_review"])));
  await db.delete(jobSources).where(eq(jobSources.id, id));
  await audit("admin.source_deleted", { actorId: user.id, targetType: "job_source", targetId: id });
  revalidatePath("/jobs");
  return ok("Source removed and its open listings closed.");
});

export const runScheduledWorkAction = callAction({ schema: z.object({}), capability: "manage:sources", rateLimit: "generic" }, async (_input, { user }) => {
  const report = await runScheduledWork("manual");
  await audit("admin.scheduled_work_run", { actorId: user.id, metadata: { sources: report.sync.length, expired: report.expiredJobs, errors: report.errors.length } });
  if (report.errors.length > 0) return fail(`Finished with errors: ${report.errors.join("; ")}`);
  return ok(`Done: ${report.sync.length} sources synchronised, ${report.expiredJobs} listings expired, ${report.alertsSent} alerts sent.`);
});

// ── Submissions: events & resources ──────────────────────────────────────────

const submissionSchema = z.object({ kind: zOneOf(["event", "resource"] as const), id: zId, decision: zOneOf(["approved", "rejected"] as const) });

export const reviewSubmissionAction = callAction({ schema: submissionSchema, capability: "moderate:submissions" }, async ({ kind, id, decision }, { user }) => {
  const updated =
    kind === "event"
      ? await db.update(events).set({ status: decision }).where(eq(events.id, id)).returning({ id: events.id })
      : await db.update(resources).set({ status: decision }).where(eq(resources.id, id)).returning({ id: resources.id });
  if (updated.length === 0) return fail("That submission could not be found.");
  await audit(`moderation.${kind}_${decision}`, { actorId: user.id, targetType: kind, targetId: id });
  return ok(decision === "approved" ? "Published." : "Rejected.");
});

// ── Categories ───────────────────────────────────────────────────────────────

const categorySchema = z.object({
  slug: zOptionalInline(60),
  name: zInline(60, 2),
  description: zOptionalText(300),
  position: zOptionalInt(0, 999),
  active: zBool,
  isNew: zBool,
});

export const saveCategoryAction = formAction({ schema: categorySchema, capability: "manage:categories" }, async (input, { user }) => {
  const slug = slugify(input.slug || input.name, 60);
  if (slug.length < 2) return fail("Enter a name.", { name: "Too short." });
  const row = { name: input.name, description: input.description ?? "", position: input.position ?? 0, active: input.active };
  if (input.isNew) {
    const created = await db.insert(categories).values({ slug, ...row }).onConflictDoNothing().returning({ slug: categories.slug });
    if (created.length === 0) return fail("A category with that name already exists.", { name: "Already exists." });
  } else {
    if (slug === "general" && !input.active) return fail("The general category is the fallback and cannot be disabled.");
    const updated = await db.update(categories).set(row).where(eq(categories.slug, slug)).returning({ slug: categories.slug });
    if (updated.length === 0) return fail("That category could not be found.");
  }
  invalidate("taxonomy:");
  await audit("admin.category_saved", { actorId: user.id, targetType: "category", targetId: slug, metadata: { active: input.active } });
  return ok("Category saved.");
});

// ── Contact inbox ────────────────────────────────────────────────────────────

export const markContactHandledAction = callAction({ schema: z.object({ id: zId }), capability: "manage:users" }, async ({ id }, { user }) => {
  await db.update(contactMessages).set({ status: "handled" }).where(and(eq(contactMessages.id, id), ne(contactMessages.status, "handled")));
  await audit("admin.contact_handled", { actorId: user.id, targetType: "contact_message", targetId: id });
  return ok("Marked as handled.");
});
