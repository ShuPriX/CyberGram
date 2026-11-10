import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type {
  ApplicationStatus,
  EmploymentType,
  ExperienceLevel,
  JobCategorySlug,
  JobSource,
  JobSourceKind,
  JobStatus,
  SourceAuthorizationBasis,
  WorkArrangement,
} from "../../lib/constants";
import { users } from "./auth";
import { companies } from "./company";
import { files } from "./platform";
import { createdAt, pk, textArray, tstz, updatedAt } from "./_shared";

/** An authorised external feed that opportunities are synchronised from. */
export const jobSources = pgTable(
  "job_sources",
  {
    id: pk(),
    name: text("name").notNull(),
    kind: text("kind").$type<JobSourceKind>().notNull(),
    /** Board token / site name for ATS boards, or the feed URL for generic feeds. */
    target: text("target").notNull(),
    /** Company the feed belongs to. Listings are attributed to it. */
    companyName: text("company_name").notNull(),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    /** Why we are permitted to list from this source — required, shown in the admin UI. */
    authorizationBasis: text("authorization_basis").$type<SourceAuthorizationBasis>().notNull(),
    authorizationNote: text("authorization_note"),
    enabled: boolean("enabled").notNull().default(true),
    /** When false, imported listings wait in the review queue before going live. */
    autoPublish: boolean("auto_publish").notNull().default(false),
    /** Keep only roles that look security-related (company-wide boards list everything). */
    securityOnly: boolean("security_only").notNull().default(true),
    intervalHours: integer("interval_hours").notNull().default(24),
    lastSyncAt: tstz("last_sync_at"),
    lastStatus: text("last_status").$type<SyncStatus>(),
    lastError: text("last_error"),
    nextSyncAt: tstz("next_sync_at"),
    /** Lease preventing two workers from syncing the same source concurrently. */
    syncStartedAt: tstz("sync_started_at"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("job_sources_kind_target_uq").on(t.kind, t.target), index("job_sources_due_idx").on(t.enabled, t.nextSyncAt)],
);

export type SyncStatus = "running" | "success" | "partial" | "failed";

export const jobSyncRuns = pgTable(
  "job_sync_runs",
  {
    id: pk(),
    sourceId: text("source_id")
      .notNull()
      .references(() => jobSources.id, { onDelete: "cascade" }),
    trigger: text("trigger").$type<"schedule" | "manual">().notNull().default("schedule"),
    status: text("status").$type<SyncStatus>().notNull().default("running"),
    startedAt: tstz("started_at").notNull().defaultNow(),
    finishedAt: tstz("finished_at"),
    fetched: integer("fetched").notNull().default(0),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    unchanged: integer("unchanged").notNull().default(0),
    expired: integer("expired").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    /** Fetched but ignored (not security-related, or missing required fields). */
    skipped: integer("skipped").notNull().default(0),
    error: text("error"),
  },
  (t) => [index("job_sync_runs_source_idx").on(t.sourceId, t.startedAt), index("job_sync_runs_started_idx").on(t.startedAt)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: pk(),
    slug: text("slug").notNull(),
    /** Null for imported / community listings whose employer has no account here. */
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    title: text("title").notNull(),
    /** Markdown. Imported HTML is converted to Markdown at ingestion and never rendered raw. */
    description: text("description").notNull(),
    category: text("category").$type<JobCategorySlug>().notNull().default("other"),
    employmentType: text("employment_type").$type<EmploymentType>().notNull().default("full_time"),
    workArrangement: text("work_arrangement").$type<WorkArrangement>().notNull().default("onsite"),
    experienceLevel: text("experience_level").$type<ExperienceLevel>().notNull().default("mid"),
    location: text("location"),
    /** ISO 3166-1 alpha-2. Null when the listing is location-agnostic. */
    country: text("country"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency"),
    salaryPeriod: text("salary_period").$type<"year" | "month" | "hour">(),
    skills: textArray("skills"),
    certifications: textArray("certifications"),
    /** `platform`: candidates apply here. `external`: they are sent to `applyUrl`. */
    applyMode: text("apply_mode").$type<"platform" | "external">().notNull().default("platform"),
    applyUrl: text("apply_url"),
    deadline: tstz("deadline"),

    status: text("status").$type<JobStatus>().notNull().default("draft"),
    /** Why a listing was held for review or rejected. */
    reviewNote: text("review_note"),
    /** Scam-pattern heuristics that matched this listing (see `lib/security/job-risk`). */
    riskFlags: textArray("risk_flags"),

    // ── Provenance: always shown to candidates ──
    source: text("source").$type<JobSource>().notNull().default("direct"),
    sourceId: text("source_id").references(() => jobSources.id, { onDelete: "set null" }),
    /** Human-readable attribution, e.g. "Acme careers (Greenhouse)". */
    sourceName: text("source_name"),
    /** The listing's canonical page at the origin. */
    sourceUrl: text("source_url"),
    externalId: text("external_id"),
    /** Normalised company + title + location hash used to detect cross-source duplicates. */
    fingerprint: text("fingerprint").notNull(),
    /** When the employer originally published the role (may predate our import). */
    postedAt: tstz("posted_at").notNull().defaultNow(),
    /** Last time we confirmed the role is still open at its source. */
    lastVerifiedAt: tstz("last_verified_at").notNull().defaultNow(),
    expiresAt: tstz("expires_at"),
    closedAt: tstz("closed_at"),
    closedReason: text("closed_reason"),

    postedById: text("posted_by_id").references(() => users.id, { onDelete: "set null" }),
    applicationCount: integer("application_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("jobs_slug_uq").on(t.slug),
    uniqueIndex("jobs_source_external_uq").on(t.sourceId, t.externalId),
    index("jobs_status_posted_idx").on(t.status, t.postedAt),
    index("jobs_company_idx").on(t.companyId, t.status),
    index("jobs_country_idx").on(t.status, t.country),
    index("jobs_level_idx").on(t.status, t.experienceLevel),
    index("jobs_category_idx").on(t.status, t.category),
    index("jobs_fingerprint_idx").on(t.fingerprint),
    index("jobs_source_idx").on(t.sourceId, t.status),
    index("jobs_skills_idx").using("gin", t.skills),
    index("jobs_search_idx").using(
      "gin",
      sql`to_tsvector('english', ${t.title} || ' ' || ${t.companyName} || ' ' || ${t.description})`,
    ),
  ],
);

export const resumes = pgTable(
  "resumes",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("resumes_user_idx").on(t.userId)],
);

export const jobApplications = pgTable(
  "job_applications",
  {
    id: pk(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The résumé file submitted with this application; recruiters may only read this one. */
    resumeFileId: text("resume_file_id").references(() => files.id, { onDelete: "set null" }),
    coverNote: text("cover_note"),
    status: text("status").$type<ApplicationStatus>().notNull().default("submitted"),
    /** Private to the hiring team. Never exposed to the candidate. */
    recruiterNote: text("recruiter_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("job_applications_job_user_uq").on(t.jobId, t.userId),
    index("job_applications_user_idx").on(t.userId, t.createdAt),
    index("job_applications_job_idx").on(t.jobId, t.status),
  ],
);

/** Candidate-visible status history for an application. */
export const applicationEvents = pgTable(
  "application_events",
  {
    id: pk(),
    applicationId: text("application_id")
      .notNull()
      .references(() => jobApplications.id, { onDelete: "cascade" }),
    status: text("status").$type<ApplicationStatus>().notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("application_events_app_idx").on(t.applicationId, t.createdAt)],
);

export const savedJobs = pgTable(
  "saved_jobs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] }), index("saved_jobs_user_idx").on(t.userId, t.createdAt)],
);

/** Saved search criteria. Mirrors the public job filters. */
export type JobAlertQuery = {
  q?: string;
  country?: string;
  remote?: boolean;
  categories?: string[];
  levels?: string[];
  types?: string[];
};

export const jobAlerts = pgTable(
  "job_alerts",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    query: jsonb("query").$type<JobAlertQuery>().notNull().default({}),
    frequency: text("frequency").$type<"daily" | "weekly">().notNull().default("daily"),
    active: boolean("active").notNull().default(true),
    lastRunAt: tstz("last_run_at"),
    createdAt: createdAt(),
  },
  (t) => [index("job_alerts_user_idx").on(t.userId), index("job_alerts_due_idx").on(t.active, t.lastRunAt)],
);
