import "server-only";
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import { jobAlerts, jobs, jobSources, jobSyncRuns, type SyncStatus } from "@/db/schema";
import { invalidate } from "@/lib/cache";
import type { EmploymentType, WorkArrangement } from "@/lib/constants";
import { fetchSourceJobs, SOURCE_KIND_LABELS, type SourceJob } from "@/lib/jobs/adapters";
import {
  buildJobSlug,
  classifyArrangement,
  classifyCategory,
  classifyEmploymentType,
  classifyLevel,
  detectCountry,
  isSecurityRole,
  jobFingerprint,
} from "@/lib/jobs/classify";
import { assessJobRisk, requiresReview } from "@/lib/security/job-risk";
import { parseHttpUrl } from "@/lib/security/link-safety";
import { cleanInline } from "@/lib/text";
import { listJobs } from "@/server/queries/jobs";
import { notify } from "./notify";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** A sync that has held its lease this long is assumed dead and may be taken over. */
const LEASE_MS = 20 * 60 * 1000;
/** Imported roles not re-confirmed at their source within this window are closed. */
const IMPORTED_STALE_MS = 4 * DAY;
/** Direct and community listings stay open this long unless renewed or given a deadline. */
export const DEFAULT_LISTING_LIFETIME_MS = 60 * DAY;

export type SyncReport = {
  sourceId: string;
  sourceName: string;
  status: SyncStatus | "skipped";
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  expired: number;
  duplicates: number;
  skipped: number;
  error?: string;
};

const EMPLOYMENT_HINTS: [RegExp, EmploymentType][] = [
  [/intern/i, "internship"],
  [/apprentice/i, "apprenticeship"],
  [/part/i, "part_time"],
  [/contract|temp/i, "contract"],
  [/freelance/i, "freelance"],
];

function normalise(source: typeof jobSources.$inferSelect, item: SourceJob) {
  const title = cleanInline(item.title).slice(0, 200);
  const companyName = cleanInline(item.companyName || source.companyName).slice(0, 120);
  const url = parseHttpUrl(item.url)?.toString() ?? null;
  if (!title || !companyName || !url || !item.externalId) return null;

  const location = item.location ? cleanInline(item.location).slice(0, 160) : null;
  const hinted = EMPLOYMENT_HINTS.find(([pattern]) => pattern.test(item.employmentHint ?? ""))?.[1];
  const employmentType = hinted ?? classifyEmploymentType(title, item.employmentHint);
  const workArrangement: WorkArrangement = classifyArrangement(location, item.arrangementHint);
  const salary = item.salary && (item.salary.min || item.salary.max) ? item.salary : null;

  return {
    externalId: String(item.externalId).slice(0, 200),
    title,
    companyName,
    description: item.description.trim() || "See the original listing for the full description.",
    location,
    country: detectCountry(location),
    category: classifyCategory(title),
    employmentType,
    workArrangement,
    experienceLevel: classifyLevel(title, employmentType),
    salaryMin: salary?.min ? Math.round(salary.min) : null,
    salaryMax: salary?.max ? Math.round(salary.max) : null,
    salaryCurrency: salary?.currency?.toUpperCase().slice(0, 3) ?? null,
    salaryPeriod: salary?.period ?? null,
    sourceUrl: url,
    postedAt: item.postedAt && item.postedAt.getTime() <= Date.now() ? item.postedAt : null,
    fingerprint: jobFingerprint(companyName, title, location),
    department: item.department ?? null,
  };
}

/**
 * Synchronises one source.
 *
 * - New roles are inserted (live if the source is trusted to auto-publish and nothing looks
 *   suspicious; otherwise into the review queue).
 * - Roles still listed are refreshed and stamped as verified now.
 * - Roles no longer listed at the source are closed immediately.
 * - A role already on the platform from another origin (same company, title and location) is
 *   counted as a duplicate and not imported twice.
 *
 * If the fetch fails, nothing is expired: an outage at the source must never wipe its listings.
 */
export async function syncSource(sourceId: string, trigger: "schedule" | "manual"): Promise<SyncReport> {
  // Take the lease atomically so two workers can never sync the same source at once.
  const leaseCutoff = new Date(Date.now() - LEASE_MS);
  const [source] = await db
    .update(jobSources)
    .set({ syncStartedAt: new Date() })
    .where(and(eq(jobSources.id, sourceId), or(isNull(jobSources.syncStartedAt), lt(jobSources.syncStartedAt, leaseCutoff))))
    .returning();

  if (!source) {
    return { sourceId, sourceName: "", status: "skipped", fetched: 0, created: 0, updated: 0, unchanged: 0, expired: 0, duplicates: 0, skipped: 0 };
  }

  const [run] = await db.insert(jobSyncRuns).values({ sourceId, trigger }).returning({ id: jobSyncRuns.id });
  const report: SyncReport = {
    sourceId,
    sourceName: source.name,
    status: "success",
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    expired: 0,
    duplicates: 0,
    skipped: 0,
  };
  const now = new Date();
  const attribution = `${source.companyName} careers (${SOURCE_KIND_LABELS[source.kind]})`;

  try {
    const fetched = await fetchSourceJobs(source.kind, source.target);
    report.fetched = fetched.length;

    const existing = await db
      .select({ id: jobs.id, externalId: jobs.externalId, status: jobs.status, title: jobs.title, description: jobs.description, location: jobs.location })
      .from(jobs)
      .where(eq(jobs.sourceId, sourceId));
    const byExternalId = new Map(existing.map((row) => [row.externalId, row]));
    const seen = new Set<string>();

    for (const item of fetched) {
      const job = normalise(source, item);
      if (!job) {
        report.skipped++;
        continue;
      }
      if (source.securityOnly && !isSecurityRole(job.title, job.department)) {
        report.skipped++;
        continue;
      }
      if (seen.has(job.externalId)) continue;
      seen.add(job.externalId);

      const current = byExternalId.get(job.externalId);
      if (current) {
        // A moderator's decision to reject or a manual close is respected, not overridden.
        if (current.status === "rejected" || current.status === "closed" || current.status === "filled") {
          report.unchanged++;
          continue;
        }
        const changed = current.title !== job.title || current.description !== job.description || current.location !== job.location;
        await db
          .update(jobs)
          .set({
            title: job.title,
            description: job.description,
            location: job.location,
            country: job.country,
            workArrangement: job.workArrangement,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            salaryCurrency: job.salaryCurrency,
            salaryPeriod: job.salaryPeriod,
            sourceUrl: job.sourceUrl,
            applyUrl: job.sourceUrl,
            fingerprint: job.fingerprint,
            lastVerifiedAt: now,
            // A role that reappears at its source after being expired is open again.
            ...(current.status === "expired" ? { status: "active" as const, closedAt: null, closedReason: null } : {}),
          })
          .where(eq(jobs.id, current.id));
        if (changed || current.status === "expired") report.updated++;
        else report.unchanged++;
        continue;
      }

      // Cross-source duplicate: the same opening is already listed from a different origin.
      const [duplicate] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.fingerprint, job.fingerprint),
            inArray(jobs.status, ["active", "pending_review"]),
            or(isNull(jobs.sourceId), ne(jobs.sourceId, sourceId)),
          ),
        )
        .limit(1);
      if (duplicate) {
        report.duplicates++;
        continue;
      }

      const flags = assessJobRisk({ title: job.title, description: job.description, applyUrl: job.sourceUrl });
      const held = !source.autoPublish || requiresReview(flags);
      const { department: _department, ...columns } = job;
      await db
        .insert(jobs)
        .values({
          ...columns,
          slug: buildJobSlug(job.title, job.companyName),
          companyId: source.companyId,
          applyMode: "external",
          applyUrl: job.sourceUrl,
          status: held ? "pending_review" : "active",
          reviewNote: held && flags.length > 0 ? flags.map((f) => f.label).join("; ") : null,
          riskFlags: flags.map((f) => f.code),
          source: "imported",
          sourceId,
          sourceName: attribution,
          postedAt: job.postedAt ?? now,
          lastVerifiedAt: now,
        })
        .onConflictDoNothing();
      report.created++;
    }

    // Anything we hold from this source that it no longer lists has closed.
    const stillListed = [...seen];
    const closed = await db
      .update(jobs)
      .set({ status: "expired", closedAt: now, closedReason: "No longer listed at the source" })
      .where(
        and(
          eq(jobs.sourceId, sourceId),
          inArray(jobs.status, ["active", "pending_review"]),
          stillListed.length > 0 ? notInArray(jobs.externalId, stillListed) : undefined,
        ),
      )
      .returning({ id: jobs.id });
    report.expired = closed.length;
  } catch (err) {
    report.status = "failed";
    report.error = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  }

  await db
    .update(jobSyncRuns)
    .set({
      status: report.status as SyncStatus,
      finishedAt: new Date(),
      fetched: report.fetched,
      created: report.created,
      updated: report.updated,
      unchanged: report.unchanged,
      expired: report.expired,
      duplicates: report.duplicates,
      skipped: report.skipped,
      error: report.error ?? null,
    })
    .where(eq(jobSyncRuns.id, run!.id));

  await db
    .update(jobSources)
    .set({
      syncStartedAt: null,
      lastSyncAt: new Date(),
      lastStatus: report.status as SyncStatus,
      lastError: report.error ?? null,
      // Failed sources are retried sooner than the regular interval.
      nextSyncAt: new Date(Date.now() + (report.status === "failed" ? Math.min(source.intervalHours, 3) : source.intervalHours) * HOUR),
    })
    .where(eq(jobSources.id, sourceId));

  invalidate("jobs:");
  return report;
}

/** Runs every enabled source whose next sync time has passed, one after another. */
export async function syncDueSources(trigger: "schedule" | "manual"): Promise<SyncReport[]> {
  const due = await db
    .select({ id: jobSources.id })
    .from(jobSources)
    .where(and(eq(jobSources.enabled, true), or(isNull(jobSources.nextSyncAt), lte(jobSources.nextSyncAt, new Date()))))
    .orderBy(asc(jobSources.nextSyncAt))
    .limit(50);
  const reports: SyncReport[] = [];
  for (const source of due) reports.push(await syncSource(source.id, trigger));
  return reports;
}

/**
 * Closes listings that should no longer be shown: past their deadline or expiry, or imported
 * roles that have not been re-confirmed at their source recently (for example because the
 * source was disabled or keeps failing).
 */
export async function expireStaleJobs(): Promise<number> {
  const now = new Date();
  const pastDate = await db
    .update(jobs)
    .set({ status: "expired", closedAt: now, closedReason: "Reached its closing date" })
    .where(
      and(
        eq(jobs.status, "active"),
        or(and(isNotNull(jobs.deadline), lte(jobs.deadline, now)), and(isNotNull(jobs.expiresAt), lte(jobs.expiresAt, now))),
      ),
    )
    .returning({ id: jobs.id });

  const unverified = await db
    .update(jobs)
    .set({ status: "expired", closedAt: now, closedReason: "Could not be re-verified at the source" })
    .where(
      and(
        eq(jobs.source, "imported"),
        isNotNull(jobs.sourceId),
        inArray(jobs.status, ["active", "pending_review"]),
        lt(jobs.lastVerifiedAt, new Date(now.getTime() - IMPORTED_STALE_MS)),
      ),
    )
    .returning({ id: jobs.id });

  if (pastDate.length + unverified.length > 0) invalidate("jobs:");
  return pastDate.length + unverified.length;
}

/** Sends each due alert a notification listing roles added since it last ran. */
export async function runJobAlerts(): Promise<number> {
  const now = Date.now();
  const alerts = await db
    .select()
    .from(jobAlerts)
    .where(
      and(
        eq(jobAlerts.active, true),
        or(
          isNull(jobAlerts.lastRunAt),
          and(eq(jobAlerts.frequency, "daily"), lt(jobAlerts.lastRunAt, new Date(now - 23 * HOUR))),
          and(eq(jobAlerts.frequency, "weekly"), lt(jobAlerts.lastRunAt, new Date(now - 7 * DAY + HOUR))),
        ),
      ),
    )
    .limit(500);

  let sent = 0;
  for (const alert of alerts) {
    const since = alert.lastRunAt ?? new Date(now - (alert.frequency === "weekly" ? 7 * DAY : DAY));
    const result = await listJobs({
      q: alert.query.q,
      country: alert.query.country,
      remote: alert.query.remote,
      categories: alert.query.categories,
      levels: alert.query.levels,
      types: alert.query.types,
      pageSize: 5,
    });
    // Only roles that reached the platform after the previous run count as new for this alert.
    const fresh = await db
      .select({ id: jobs.id, title: jobs.title, companyName: jobs.companyName })
      .from(jobs)
      .where(and(inArray(jobs.id, result.items.length ? result.items.map((j) => j.id) : [""]), gt(jobs.createdAt, since)));

    if (fresh.length > 0) {
      const first = fresh[0]!;
      const more = fresh.length - 1;
      await notify({
        userId: alert.userId,
        type: "job_alert",
        entityType: "job_alert",
        entityId: alert.id,
        data: {
          title: `New roles for “${alert.name}”`,
          preview: `${first.title} at ${first.companyName}${more > 0 ? ` and ${more} more` : ""}`,
          href: `/jobs/alerts?alert=${alert.id}`,
        },
      });
      sent++;
    }
    await db.update(jobAlerts).set({ lastRunAt: new Date() }).where(eq(jobAlerts.id, alert.id));
  }
  return sent;
}


