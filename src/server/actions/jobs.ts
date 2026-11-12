"use server";

import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { applicationEvents, companyMembers, files, jobAlerts, jobApplications, jobs, resumes, savedJobs } from "@/db/schema";
import {
  APPLICATION_STATUS_META,
  EMPLOYMENT_TYPE_VALUES,
  EXPERIENCE_LEVEL_VALUES,
  JOB_CATEGORY_SLUGS,
  LIMITS,
  RECRUITER_APPLICATION_STATUSES,
  SALARY_CURRENCIES,
  WORK_ARRANGEMENT_VALUES,
  type ApplicationStatus,
} from "@/lib/constants";
import { buildJobSlug, jobFingerprint } from "@/lib/jobs/classify";
import { audit } from "@/lib/security/audit";
import { assessJobRisk, requiresReview } from "@/lib/security/job-risk";
import {
  zBool,
  zCountry,
  zCsv,
  zHttpUrl,
  zId,
  zInline,
  zManyOf,
  zOneOf,
  zOptionalDateTime,
  zOptionalId,
  zOptionalInline,
  zOptionalInt,
  zOptionalOneOf,
  zOptionalText,
  zOptionalUrl,
  zSkills,
  zText,
} from "@/lib/validation";
import { callAction, fail, formAction, ok } from "@/server/action-utils";
import { openJobCondition } from "@/server/queries/jobs";
import { ownedFileId, requireCompanyAccess } from "@/server/services/access";
import { DEFAULT_LISTING_LIFETIME_MS } from "@/server/services/job-sync";
import { notify } from "@/server/services/notify";

// ── Candidates: save, apply, withdraw ────────────────────────────────────────

export const toggleSaveJobAction = callAction({ schema: z.object({ jobId: zId }), rateLimit: "reaction" }, async ({ jobId }, { user }) => {
  const removed = await db.delete(savedJobs).where(and(eq(savedJobs.userId, user.id), eq(savedJobs.jobId, jobId))).returning({ id: savedJobs.jobId });
  if (removed.length > 0) return ok("Removed from saved jobs.", { saved: false });
  // Only listings that are, or were, public can be saved: a guessed id must never reveal an unpublished one.
  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["active", "closed", "filled", "expired"])))
    .limit(1);
  if (!job) return fail("That listing is no longer available.");
  await db.insert(savedJobs).values({ userId: user.id, jobId }).onConflictDoNothing();
  return ok("Job saved.", { saved: true });
});

const applySchema = z.object({ jobId: zId, resumeId: zOptionalId, coverNote: zOptionalText(3000) });

export const applyToJobAction = formAction({ schema: applySchema, rateLimit: "application" }, async (input, { user }) => {
  if (!user.emailVerified) return fail("Verify your email address before applying, so employers can reach you.");
  const [job] = await db
    .select({ id: jobs.id, slug: jobs.slug, title: jobs.title, companyId: jobs.companyId, companyName: jobs.companyName, applyMode: jobs.applyMode, postedById: jobs.postedById })
    .from(jobs)
    .where(and(eq(jobs.id, input.jobId), openJobCondition()))
    .limit(1);
  if (!job) return fail("This role is no longer accepting applications.");
  if (job.applyMode !== "platform") return fail("Applications for this role are handled on the employer's site.");
  if (job.companyId) {
    const [member] = await db.select({ userId: companyMembers.userId }).from(companyMembers).where(and(eq(companyMembers.companyId, job.companyId), eq(companyMembers.userId, user.id))).limit(1);
    if (member) return fail("You cannot apply to a role at an organisation you manage.");
  }

  let resumeFileId: string | null = null;
  if (input.resumeId) {
    const [resume] = await db.select({ fileId: resumes.fileId }).from(resumes).where(and(eq(resumes.id, input.resumeId), eq(resumes.userId, user.id))).limit(1);
    if (!resume) return fail("That résumé could not be found. Please choose another.", { resumeId: "Choose a résumé." });
    resumeFileId = resume.fileId;
  }

  const [existing] = await db.select({ id: jobApplications.id, status: jobApplications.status }).from(jobApplications).where(and(eq(jobApplications.jobId, job.id), eq(jobApplications.userId, user.id))).limit(1);
  let applicationId: string;
  if (existing) {
    if (existing.status !== "withdrawn") return ok("You have already applied to this role.");
    await db.update(jobApplications).set({ status: "submitted", resumeFileId, coverNote: input.coverNote ?? null }).where(eq(jobApplications.id, existing.id));
    applicationId = existing.id;
  } else {
    const [created] = await db
      .insert(jobApplications)
      .values({ jobId: job.id, userId: user.id, resumeFileId, coverNote: input.coverNote ?? null })
      .onConflictDoNothing()
      .returning({ id: jobApplications.id });
    if (!created) return ok("You have already applied to this role.");
    applicationId = created.id;
    await db.update(jobs).set({ applicationCount: sql`${jobs.applicationCount} + 1` }).where(eq(jobs.id, job.id));
  }
  await db.insert(applicationEvents).values({ applicationId, status: "submitted", actorId: user.id });

  if (job.companyId) {
    const team = await db.select({ userId: companyMembers.userId }).from(companyMembers).where(eq(companyMembers.companyId, job.companyId)).limit(25);
    for (const member of team) {
      await notify({
        userId: member.userId,
        actorId: user.id,
        type: "new_applicant",
        entityType: "application",
        entityId: applicationId,
        data: { title: `New applicant for ${job.title}`, preview: user.name, href: `/recruiter/jobs/${job.id}` },
      });
    }
  }
  revalidatePath(`/jobs/${job.slug}`);
  return ok(`Application sent to ${job.companyName}. Track it under My applications.`);
});

export const withdrawApplicationAction = callAction({ schema: z.object({ id: zId }), rateLimit: "application" }, async ({ id }, { user }) => {
  const [updated] = await db
    .update(jobApplications)
    .set({ status: "withdrawn" })
    .where(and(eq(jobApplications.id, id), eq(jobApplications.userId, user.id), inArray(jobApplications.status, ["submitted", "in_review", "shortlisted", "interview"])))
    .returning({ id: jobApplications.id });
  if (!updated) return fail("This application can no longer be withdrawn.");
  await db.insert(applicationEvents).values({ applicationId: id, status: "withdrawn", actorId: user.id });
  return ok("Application withdrawn.");
});

// ── Résumés ──────────────────────────────────────────────────────────────────

export const addResumeAction = formAction({ schema: z.object({ fileId: zId, label: zInline(80, 2) }), rateLimit: "profileWrite" }, async (input, { user }) => {
  const fileId = await ownedFileId(user.id, input.fileId, "resume");
  const [total] = await db.select({ value: count() }).from(resumes).where(eq(resumes.userId, user.id));
  if ((total?.value ?? 0) >= LIMITS.resumesPerUser) return fail(`You can keep up to ${LIMITS.resumesPerUser} résumés. Remove one first.`);
  const [dup] = await db.select({ id: resumes.id }).from(resumes).where(and(eq(resumes.userId, user.id), eq(resumes.fileId, fileId!))).limit(1);
  if (dup) return ok("That résumé is already saved.");
  await db.insert(resumes).values({ userId: user.id, fileId: fileId!, label: input.label, isDefault: (total?.value ?? 0) === 0 });
  return ok("Résumé saved. Only you and employers you apply to can open it.");
});

export const deleteResumeAction = callAction({ schema: z.object({ id: zId }) }, async ({ id }, { user }) => {
  const [removed] = await db.delete(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).returning({ fileId: resumes.fileId, isDefault: resumes.isDefault });
  if (!removed) return fail("That résumé could not be found.");
  // Keep the file itself if an employer already received it with an application.
  const [used] = await db.select({ id: jobApplications.id }).from(jobApplications).where(eq(jobApplications.resumeFileId, removed.fileId)).limit(1);
  if (!used) await db.delete(files).where(and(eq(files.id, removed.fileId), eq(files.ownerId, user.id)));
  if (removed.isDefault) {
    const [next] = await db.select({ id: resumes.id }).from(resumes).where(eq(resumes.userId, user.id)).limit(1);
    if (next) await db.update(resumes).set({ isDefault: true }).where(eq(resumes.id, next.id));
  }
  return ok("Résumé removed.");
});

export const setDefaultResumeAction = callAction({ schema: z.object({ id: zId }) }, async ({ id }, { user }) => {
  const [target] = await db.select({ id: resumes.id }).from(resumes).where(and(eq(resumes.id, id), eq(resumes.userId, user.id))).limit(1);
  if (!target) return fail("That résumé could not be found.");
  await db.update(resumes).set({ isDefault: sql`${resumes.id} = ${id}` }).where(eq(resumes.userId, user.id));
  return ok("Default résumé updated.");
});

// ── Job alerts ───────────────────────────────────────────────────────────────

const alertSchema = z.object({
  name: zInline(80, 2),
  q: zOptionalInline(100),
  country: zCountry,
  remote: zBool,
  categories: zManyOf(JOB_CATEGORY_SLUGS, 8),
  levels: zManyOf(EXPERIENCE_LEVEL_VALUES),
  types: zManyOf(EMPLOYMENT_TYPE_VALUES),
  frequency: zOneOf(["daily", "weekly"] as const).default("daily"),
});

export const saveJobAlertAction = formAction({ schema: alertSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const [total] = await db.select({ value: count() }).from(jobAlerts).where(eq(jobAlerts.userId, user.id));
  if ((total?.value ?? 0) >= 10) return fail("You can keep up to 10 job alerts. Remove one first.");
  const { name, frequency, ...query } = input;
  await db.insert(jobAlerts).values({
    userId: user.id,
    name,
    frequency,
    query: { q: query.q, country: query.country, remote: query.remote || undefined, categories: query.categories, levels: query.levels, types: query.types },
    // Start from now so the first digest only contains roles posted after the alert was created.
    lastRunAt: new Date(),
  });
  return ok("Alert created. Matching roles will arrive in your notifications.");
});

export const updateJobAlertAction = callAction({ schema: z.object({ id: zId, active: z.boolean().optional(), remove: z.boolean().optional() }) }, async ({ id, active, remove }, { user }) => {
  const mine = and(eq(jobAlerts.id, id), eq(jobAlerts.userId, user.id));
  if (remove) {
    await db.delete(jobAlerts).where(mine);
    return ok("Alert removed.");
  }
  await db.update(jobAlerts).set({ active: active ?? true }).where(mine);
  return ok(active ? "Alert resumed." : "Alert paused.");
});

// ── Listings: shared fields ──────────────────────────────────────────────────

const listingShape = {
  title: zInline(140, 4),
  description: zText(20_000, 80),
  category: zOneOf(JOB_CATEGORY_SLUGS),
  employmentType: zOneOf(EMPLOYMENT_TYPE_VALUES),
  workArrangement: zOneOf(WORK_ARRANGEMENT_VALUES),
  experienceLevel: zOneOf(EXPERIENCE_LEVEL_VALUES),
  location: zOptionalInline(120),
  country: zCountry,
  salaryMin: zOptionalInt(0, 100_000_000),
  salaryMax: zOptionalInt(0, 100_000_000),
  salaryCurrency: zOptionalOneOf(SALARY_CURRENCIES),
  salaryPeriod: zOptionalOneOf(["year", "month", "hour"] as const),
  skills: zSkills(LIMITS.skillsPerJob),
  certifications: zCsv(10, 60),
  deadline: zOptionalDateTime,
};

type ListingInput = z.output<z.ZodObject<typeof listingShape>>;

function listingProblems(input: ListingInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (input.salaryMin && input.salaryMax && input.salaryMax < input.salaryMin) errors.salaryMax = "The maximum is below the minimum.";
  if ((input.salaryMin || input.salaryMax) && !input.salaryCurrency) errors.salaryCurrency = "Choose a currency.";
  if (input.deadline && input.deadline.getTime() < Date.now()) errors.deadline = "The deadline is in the past.";
  if (input.workArrangement !== "remote" && !input.location && !input.country) errors.location = "Add a location for on-site and hybrid roles.";
  return Object.keys(errors).length > 0 ? errors : null;
}

const listingColumns = (input: ListingInput) => ({
  title: input.title,
  description: input.description,
  category: input.category,
  employmentType: input.employmentType,
  workArrangement: input.workArrangement,
  experienceLevel: input.experienceLevel,
  location: input.location ?? null,
  country: input.country ?? null,
  salaryMin: input.salaryMin ?? null,
  salaryMax: input.salaryMax ?? null,
  salaryCurrency: input.salaryMin || input.salaryMax ? (input.salaryCurrency ?? null) : null,
  salaryPeriod: input.salaryMin || input.salaryMax ? (input.salaryPeriod ?? "year") : null,
  skills: input.skills,
  certifications: input.certifications,
  deadline: input.deadline ?? null,
});

// ── Recruiters: post and manage listings ─────────────────────────────────────

const companyJobSchema = z.object({
  ...listingShape,
  id: zOptionalId,
  companyId: zId,
  applyMode: zOneOf(["platform", "external"] as const).default("platform"),
  applyUrl: zOptionalUrl,
  intent: zOneOf(["publish", "draft"] as const).default("publish"),
});

/**
 * Creates or edits a listing for an organisation the caller belongs to. Listings from
 * organisations that have not been verified, and any listing matching a scam heuristic, are
 * held for a moderator instead of going live.
 */
export const saveCompanyJobAction = formAction({ schema: companyJobSchema, rateLimit: "jobPost" }, async (input, { user }) => {
  const { company } = await requireCompanyAccess(user.id, input.companyId);
  const problems = listingProblems(input);
  if (problems) return fail("Please check the highlighted fields.", problems);
  if (input.applyMode === "external" && !input.applyUrl) return fail("Add the application link.", { applyUrl: "Enter the URL candidates should apply at." });

  const verified = company.verificationStatus === "verified";
  const flags = assessJobRisk({ title: input.title, description: input.description, applyUrl: input.applyUrl, companyVerified: verified });
  const held = !verified || requiresReview(flags);
  const status = input.intent === "draft" ? ("draft" as const) : held ? ("pending_review" as const) : ("active" as const);
  const reviewNote =
    status !== "pending_review" ? null : flags.length > 0 ? flags.map((f) => f.label).join("; ") : "Organisation is not verified yet — first listings are reviewed";
  const now = new Date();
  const columns = {
    ...listingColumns(input),
    applyMode: input.applyMode,
    applyUrl: input.applyMode === "external" ? (input.applyUrl ?? null) : null,
    companyName: company.name,
    fingerprint: jobFingerprint(company.name, input.title, input.location),
    riskFlags: flags.map((f) => f.code),
    reviewNote,
    status,
  };

  let jobId = input.id;
  if (jobId) {
    const [current] = await db.select({ status: jobs.status }).from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.companyId, company.id), eq(jobs.source, "direct"))).limit(1);
    if (!current) return fail("That listing could not be found.");
    if (current.status === "rejected") return fail("This listing was rejected by a moderator and cannot be republished. Create a new listing instead.");
    await db
      .update(jobs)
      .set({
        ...columns,
        lastVerifiedAt: now,
        ...(status === "active" ? { expiresAt: new Date(now.getTime() + DEFAULT_LISTING_LIFETIME_MS), closedAt: null, closedReason: null } : {}),
      })
      .where(eq(jobs.id, jobId));
  } else {
    const [created] = await db
      .insert(jobs)
      .values({
        ...columns,
        slug: buildJobSlug(input.title, company.name),
        companyId: company.id,
        source: "direct",
        sourceName: company.name,
        postedById: user.id,
        postedAt: now,
        lastVerifiedAt: now,
        expiresAt: new Date(now.getTime() + DEFAULT_LISTING_LIFETIME_MS),
      })
      .returning({ id: jobs.id });
    jobId = created!.id;
  }
  await audit("job.saved", { actorId: user.id, targetType: "job", targetId: jobId, metadata: { status, flags: flags.map((f) => f.code) } });
  revalidatePath("/jobs");
  redirect(`/recruiter/jobs/${jobId}?saved=${status}`);
});

export const setJobStatusAction = callAction(
  { schema: z.object({ id: zId, status: zOneOf(["closed", "filled", "reopen"] as const) }), rateLimit: "jobPost" },
  async ({ id, status }, { user }) => {
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.source, "direct"))).limit(1);
    if (!job?.companyId) return fail("That listing could not be found.");
    const { company } = await requireCompanyAccess(user.id, job.companyId);
    const now = new Date();
    if (status === "reopen") {
      if (!["closed", "filled", "expired"].includes(job.status)) return fail("Only closed listings can be reopened.");
      const verified = company.verificationStatus === "verified";
      const held = !verified || job.riskFlags.length > 0;
      await db
        .update(jobs)
        .set({
          status: held ? "pending_review" : "active",
          reviewNote: held ? "Reopened listing awaiting review" : null,
          closedAt: null,
          closedReason: null,
          lastVerifiedAt: now,
          expiresAt: new Date(now.getTime() + DEFAULT_LISTING_LIFETIME_MS),
          deadline: job.deadline && job.deadline.getTime() < now.getTime() ? null : job.deadline,
        })
        .where(eq(jobs.id, id));
      return ok(held ? "Reopened — it will be visible again after review." : "Listing reopened.");
    }
    if (!["active", "pending_review", "draft"].includes(job.status)) return fail("This listing is already closed.");
    await db.update(jobs).set({ status, closedAt: now, closedReason: status === "filled" ? "Position filled" : "Closed by the employer" }).where(eq(jobs.id, id));
    await audit("job.closed", { actorId: user.id, targetType: "job", targetId: id, metadata: { status } });
    revalidatePath(`/jobs/${job.slug}`);
    return ok(status === "filled" ? "Marked as filled. It no longer appears in search." : "Listing closed.");
  },
);

const applicationUpdateSchema = z.object({
  id: zId,
  status: zOptionalOneOf(RECRUITER_APPLICATION_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]),
  recruiterNote: zOptionalText(2000),
});

export const updateApplicationAction = formAction({ schema: applicationUpdateSchema, rateLimit: "generic" }, async (input, { user }) => {
  const [row] = await db
    .select({ application: jobApplications, jobTitle: jobs.title, companyId: jobs.companyId, companyName: jobs.companyName })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .where(eq(jobApplications.id, input.id))
    .limit(1);
  if (!row?.companyId) return fail("That application could not be found.");
  await requireCompanyAccess(user.id, row.companyId);
  if (row.application.status === "withdrawn") return fail("The candidate withdrew this application.");

  const statusChanged = input.status !== undefined && input.status !== row.application.status;
  await db
    .update(jobApplications)
    .set({ ...(statusChanged ? { status: input.status } : {}), recruiterNote: input.recruiterNote ?? null })
    .where(eq(jobApplications.id, input.id));
  if (statusChanged) {
    await db.insert(applicationEvents).values({ applicationId: input.id, status: input.status!, actorId: user.id });
    await notify({
      userId: row.application.userId,
      type: "application_update",
      entityType: "application",
      entityId: input.id,
      data: {
        title: `Application update: ${row.jobTitle}`,
        preview: `${row.companyName} moved your application to “${APPLICATION_STATUS_META[input.status!].label}”.`,
        href: "/jobs/applications",
      },
    });
  }
  return ok("Application updated.");
});

// ── Community-submitted listings ─────────────────────────────────────────────

const communityJobSchema = z.object({
  ...listingShape,
  companyName: zInline(120, 2),
  applyUrl: zHttpUrl,
  confirm: zBool,
});

/**
 * A member shares a role they found elsewhere. It always links to the employer's own posting
 * and is always reviewed by a moderator before it is shown, labelled as community-submitted.
 */
export const submitCommunityJobAction = formAction({ schema: communityJobSchema, rateLimit: "submission" }, async (input, { user }) => {
  if (!user.emailVerified) return fail("Verify your email address before submitting listings.");
  if (!input.confirm) return fail("Please confirm the listing is genuine.", { confirm: "Required." });
  const problems = listingProblems(input);
  if (problems) return fail("Please check the highlighted fields.", problems);

  const fingerprint = jobFingerprint(input.companyName, input.title, input.location);
  const [duplicate] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.fingerprint, fingerprint), inArray(jobs.status, ["active", "pending_review"]))).limit(1);
  if (duplicate) return fail("This role already appears to be listed. Thanks for checking.");
  const [byUrl] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.applyUrl, input.applyUrl), ne(jobs.status, "rejected"))).limit(1);
  if (byUrl) return fail("A listing with this application link has already been submitted.");

  const flags = assessJobRisk({ title: input.title, description: input.description, applyUrl: input.applyUrl });
  const now = new Date();
  const [created] = await db
    .insert(jobs)
    .values({
      ...listingColumns(input),
      slug: buildJobSlug(input.title, input.companyName),
      companyName: input.companyName,
      applyMode: "external",
      applyUrl: input.applyUrl,
      sourceUrl: input.applyUrl,
      source: "community",
      sourceName: "Community submission",
      status: "pending_review",
      reviewNote: flags.length > 0 ? flags.map((f) => f.label).join("; ") : "Community submission awaiting review",
      riskFlags: flags.map((f) => f.code),
      fingerprint,
      postedById: user.id,
      postedAt: now,
      lastVerifiedAt: now,
      expiresAt: new Date(now.getTime() + DEFAULT_LISTING_LIFETIME_MS / 2),
    })
    .returning({ id: jobs.id });
  await audit("job.community_submitted", { actorId: user.id, targetType: "job", targetId: created!.id });
  return ok("Thank you. A moderator will check the listing against its source before it is published.");
});
