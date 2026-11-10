import "server-only";
import { and, arrayOverlaps, count, desc, eq, gt, gte, ilike, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, jobApplications, jobs, savedJobs } from "@/db/schema";
import {
  EARLY_CAREER_LEVELS,
  LIMITS,
  type EmploymentType,
  type ExperienceLevel,
  type JobCategorySlug,
  type JobSource,
  type WorkArrangement,
} from "@/lib/constants";

/**
 * A listing is shown to candidates only while it is genuinely open: published, not past its
 * deadline, and not past its expiry. Every public job query goes through this condition so an
 * expired role can never be presented as active.
 */
export function openJobCondition(): SQL {
  return and(
    eq(jobs.status, "active"),
    or(isNull(jobs.expiresAt), gt(jobs.expiresAt, sql`now()`)),
    or(isNull(jobs.deadline), gt(jobs.deadline, sql`now()`)),
  )!;
}

const searchDocument = sql`to_tsvector('english', ${jobs.title} || ' ' || ${jobs.companyName} || ' ' || ${jobs.description})`;

/** Escapes LIKE wildcards in user input. */
export const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, "\\$&")}%`;

export type JobFilters = {
  q?: string;
  /** ISO country code. */
  country?: string;
  remote?: boolean;
  categories?: string[];
  levels?: string[];
  types?: string[];
  arrangements?: string[];
  skills?: string[];
  companyId?: string;
  source?: JobSource;
  postedWithinDays?: number;
  hasSalary?: boolean;
  sort?: "recent" | "relevance";
  page?: number;
  pageSize?: number;
  /** Within each posting day, list internships and fresher roles first. */
  prioritizeEarlyCareer?: boolean;
  /** Restrict to internships, apprenticeships and student/fresher roles. */
  earlyCareerOnly?: boolean;
  viewerId?: string | null;
  excludeId?: string;
};

export type JobListItem = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  company: { slug: string; logoFileId: string | null; verified: boolean } | null;
  category: JobCategorySlug;
  employmentType: EmploymentType;
  workArrangement: WorkArrangement;
  experienceLevel: ExperienceLevel;
  location: string | null;
  country: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: "year" | "month" | "hour" | null;
  skills: string[];
  source: JobSource;
  sourceName: string | null;
  postedAt: Date;
  lastVerifiedAt: Date;
  /** Added to the platform within the last 48 hours. */
  isNew: boolean;
  isDemo: boolean;
  viewer: { saved: boolean; applied: boolean };
};

export type JobList = { items: JobListItem[]; total: number; page: number; pageSize: number; hasMore: boolean };

const earlyCareerSql = sql`(${jobs.experienceLevel} in ('student', 'fresher') or ${jobs.employmentType} in ('internship', 'apprenticeship'))`;

export function jobFilterConditions(filters: JobFilters): SQL[] {
  const where: SQL[] = [openJobCondition()];
  const q = filters.q?.trim().slice(0, 100);
  if (q) {
    where.push(
      or(
        sql`${searchDocument} @@ websearch_to_tsquery('english', ${q})`,
        ilike(jobs.title, likePattern(q)),
        ilike(jobs.companyName, likePattern(q)),
      )!,
    );
  }
  if (filters.country) where.push(eq(jobs.country, filters.country));
  if (filters.remote) where.push(eq(jobs.workArrangement, "remote"));
  if (filters.categories?.length) where.push(inArray(jobs.category, filters.categories as JobCategorySlug[]));
  if (filters.levels?.length) where.push(inArray(jobs.experienceLevel, filters.levels as ExperienceLevel[]));
  if (filters.types?.length) where.push(inArray(jobs.employmentType, filters.types as EmploymentType[]));
  if (filters.arrangements?.length) where.push(inArray(jobs.workArrangement, filters.arrangements as WorkArrangement[]));
  if (filters.skills?.length) where.push(arrayOverlaps(jobs.skills, filters.skills));
  if (filters.companyId) where.push(eq(jobs.companyId, filters.companyId));
  if (filters.source) where.push(eq(jobs.source, filters.source));
  if (filters.hasSalary) where.push(sql`(${jobs.salaryMin} is not null or ${jobs.salaryMax} is not null)`);
  if (filters.earlyCareerOnly) where.push(earlyCareerSql);
  if (filters.excludeId) where.push(ne(jobs.id, filters.excludeId));
  if (filters.postedWithinDays) {
    where.push(gte(jobs.postedAt, new Date(Date.now() - filters.postedWithinDays * 24 * 60 * 60 * 1000)));
  }
  return where;
}

const listColumns = {
  id: jobs.id,
  slug: jobs.slug,
  title: jobs.title,
  companyName: jobs.companyName,
  category: jobs.category,
  employmentType: jobs.employmentType,
  workArrangement: jobs.workArrangement,
  experienceLevel: jobs.experienceLevel,
  location: jobs.location,
  country: jobs.country,
  salaryMin: jobs.salaryMin,
  salaryMax: jobs.salaryMax,
  salaryCurrency: jobs.salaryCurrency,
  salaryPeriod: jobs.salaryPeriod,
  skills: jobs.skills,
  source: jobs.source,
  sourceName: jobs.sourceName,
  postedAt: jobs.postedAt,
  lastVerifiedAt: jobs.lastVerifiedAt,
  createdAt: jobs.createdAt,
  isDemo: jobs.isDemo,
  companySlug: companies.slug,
  companyLogo: companies.logoFileId,
  companyVerification: companies.verificationStatus,
};

const listQuery = () => db.select(listColumns).from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id)).$dynamic();
type ListRow = Awaited<ReturnType<typeof listQuery>>[number];

const NEW_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Adds the viewer's saved/applied state to a page of rows in two batched lookups. */
export async function decorateJobs(rows: ListRow[], viewerId?: string | null): Promise<JobListItem[]> {
  const ids = rows.map((r) => r.id);
  let saved = new Set<string>();
  let applied = new Set<string>();
  if (viewerId && ids.length > 0) {
    const [savedRows, appliedRows] = await Promise.all([
      db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(and(eq(savedJobs.userId, viewerId), inArray(savedJobs.jobId, ids))),
      db
        .select({ jobId: jobApplications.jobId })
        .from(jobApplications)
        .where(and(eq(jobApplications.userId, viewerId), inArray(jobApplications.jobId, ids), ne(jobApplications.status, "withdrawn"))),
    ]);
    saved = new Set(savedRows.map((r) => r.jobId));
    applied = new Set(appliedRows.map((r) => r.jobId));
  }
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    companyName: row.companyName,
    company: row.companySlug
      ? { slug: row.companySlug, logoFileId: row.companyLogo, verified: row.companyVerification === "verified" }
      : null,
    category: row.category,
    employmentType: row.employmentType,
    workArrangement: row.workArrangement,
    experienceLevel: row.experienceLevel,
    location: row.location,
    country: row.country,
    salaryMin: row.salaryMin,
    salaryMax: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod,
    skills: row.skills,
    source: row.source,
    sourceName: row.sourceName,
    postedAt: row.postedAt,
    lastVerifiedAt: row.lastVerifiedAt,
    isNew: now - row.createdAt.getTime() < NEW_WINDOW_MS,
    isDemo: row.isDemo,
    viewer: { saved: saved.has(row.id), applied: applied.has(row.id) },
  }));
}

export async function listJobs(filters: JobFilters = {}): Promise<JobList> {
  const pageSize = Math.min(Math.max(filters.pageSize ?? LIMITS.jobsPageSize, 1), 50);
  const page = Math.min(Math.max(filters.page ?? 1, 1), 200);
  const where = and(...jobFilterConditions(filters));
  const q = filters.q?.trim().slice(0, 100);

  const order: SQL[] = [];
  if (q && filters.sort === "relevance") {
    order.push(sql`ts_rank(${searchDocument}, websearch_to_tsquery('english', ${q})) desc`);
  }
  if (filters.prioritizeEarlyCareer) {
    order.push(sql`date_trunc('day', ${jobs.postedAt}) desc`, sql`${earlyCareerSql} desc`);
  }
  order.push(desc(jobs.postedAt), desc(jobs.id));

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(listColumns)
      .from(jobs)
      .leftJoin(companies, eq(jobs.companyId, companies.id))
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(jobs).where(where),
  ]);

  const total = totalRow?.value ?? 0;
  return {
    items: await decorateJobs(rows, filters.viewerId),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/** Jobs by their ids, preserving the given order. Used for saved lists and alerts. */
export async function listJobsByIds(ids: string[], viewerId?: string | null): Promise<JobListItem[]> {
  if (ids.length === 0) return [];
  const rows = await db.select(listColumns).from(jobs).leftJoin(companies, eq(jobs.companyId, companies.id)).where(inArray(jobs.id, ids));
  const decorated = await decorateJobs(rows, viewerId);
  const byId = new Map(decorated.map((j) => [j.id, j]));
  return ids.map((id) => byId.get(id)).filter((j): j is JobListItem => Boolean(j));
}

export type JobDetail = typeof jobs.$inferSelect & {
  company: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logoFileId: string | null;
    website: string | null;
    size: string | null;
    hqLocation: string | null;
    verified: boolean;
  } | null;
  /** Currently accepting applications. False for closed, filled, expired or unpublished roles. */
  isOpen: boolean;
};

export async function getJobBySlug(slug: string): Promise<JobDetail | null> {
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return null;
  const [row] = await db
    .select({ job: jobs, company: companies, isOpen: sql<boolean>`${openJobCondition()}` })
    .from(jobs)
    .leftJoin(companies, eq(jobs.companyId, companies.id))
    .where(eq(jobs.slug, slug))
    .limit(1);
  if (!row) return null;
  return {
    ...row.job,
    isOpen: Boolean(row.isOpen),
    company: row.company
      ? {
          id: row.company.id,
          slug: row.company.slug,
          name: row.company.name,
          tagline: row.company.tagline,
          logoFileId: row.company.logoFileId,
          website: row.company.website,
          size: row.company.size,
          hqLocation: row.company.hqLocation,
          verified: row.company.verificationStatus === "verified",
        }
      : null,
  };
}

export async function getViewerJobState(jobId: string, userId: string) {
  const [[saved], [application]] = await Promise.all([
    db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(and(eq(savedJobs.userId, userId), eq(savedJobs.jobId, jobId))).limit(1),
    db
      .select({ id: jobApplications.id, status: jobApplications.status, createdAt: jobApplications.createdAt })
      .from(jobApplications)
      .where(and(eq(jobApplications.userId, userId), eq(jobApplications.jobId, jobId)))
      .limit(1),
  ]);
  return { saved: Boolean(saved), application: application ?? null };
}

/** Counts of open roles per facet value, for filter sidebars and landing pages. */
export async function getJobFacetCounts() {
  const open = openJobCondition();
  const [byCategory, byLevel, byCountry, [remote], [total], [early]] = await Promise.all([
    db.select({ key: jobs.category, value: count() }).from(jobs).where(open).groupBy(jobs.category),
    db.select({ key: jobs.experienceLevel, value: count() }).from(jobs).where(open).groupBy(jobs.experienceLevel),
    db.select({ key: jobs.country, value: count() }).from(jobs).where(open).groupBy(jobs.country),
    db.select({ value: count() }).from(jobs).where(and(open, eq(jobs.workArrangement, "remote"))),
    db.select({ value: count() }).from(jobs).where(open),
    db.select({ value: count() }).from(jobs).where(and(open, earlyCareerSql)),
  ]);
  const toMap = (rows: { key: string | null; value: number }[]) =>
    Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.key!, r.value])) as Record<string, number>;
  return {
    total: total?.value ?? 0,
    remote: remote?.value ?? 0,
    earlyCareer: early?.value ?? 0,
    categories: toMap(byCategory),
    levels: toMap(byLevel),
    countries: toMap(byCountry),
  };
}

export { EARLY_CAREER_LEVELS };
