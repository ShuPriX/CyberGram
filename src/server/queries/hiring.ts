import "server-only";
import { and, arrayOverlaps, asc, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, companies, files, jobAlerts, jobApplications, jobs, profiles, resumes, savedJobs, users } from "@/db/schema";
import type { ApplicationStatus, JobStatus } from "@/lib/constants";
import { likePattern, listJobsByIds, type JobListItem } from "./jobs";

// ── Candidate side ───────────────────────────────────────────────────────────

export async function listSavedJobs(userId: string): Promise<JobListItem[]> {
  const rows = await db.select({ jobId: savedJobs.jobId }).from(savedJobs).where(eq(savedJobs.userId, userId)).orderBy(desc(savedJobs.createdAt)).limit(200);
  return listJobsByIds(rows.map((r) => r.jobId), userId);
}

export type MyApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
  job: { slug: string; title: string; companyName: string; status: JobStatus; logoFileId: string | null };
  events: { status: ApplicationStatus; createdAt: Date }[];
};

export async function listMyApplications(userId: string): Promise<MyApplication[]> {
  const rows = await db
    .select({
      id: jobApplications.id,
      status: jobApplications.status,
      createdAt: jobApplications.createdAt,
      updatedAt: jobApplications.updatedAt,
      slug: jobs.slug,
      title: jobs.title,
      companyName: jobs.companyName,
      jobStatus: jobs.status,
      logoFileId: companies.logoFileId,
    })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(jobApplications.userId, userId))
    .orderBy(desc(jobApplications.updatedAt))
    .limit(200);
  if (rows.length === 0) return [];
  const events = await db
    .select({ applicationId: applicationEvents.applicationId, status: applicationEvents.status, createdAt: applicationEvents.createdAt })
    .from(applicationEvents)
    .where(inArray(applicationEvents.applicationId, rows.map((r) => r.id)))
    .orderBy(asc(applicationEvents.createdAt));
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    job: { slug: row.slug, title: row.title, companyName: row.companyName, status: row.jobStatus, logoFileId: row.logoFileId },
    events: events.filter((e) => e.applicationId === row.id).map(({ status, createdAt }) => ({ status, createdAt })),
  }));
}

export type ResumeItem = { id: string; label: string; isDefault: boolean; createdAt: Date; fileId: string; fileName: string; size: number };

export async function listResumes(userId: string): Promise<ResumeItem[]> {
  return db
    .select({ id: resumes.id, label: resumes.label, isDefault: resumes.isDefault, createdAt: resumes.createdAt, fileId: files.id, fileName: files.originalName, size: files.size })
    .from(resumes)
    .innerJoin(files, eq(files.id, resumes.fileId))
    .where(eq(resumes.userId, userId))
    .orderBy(desc(resumes.isDefault), desc(resumes.createdAt));
}

export async function listJobAlerts(userId: string) {
  return db.select().from(jobAlerts).where(eq(jobAlerts.userId, userId)).orderBy(desc(jobAlerts.createdAt));
}

// ── Recruiter side ───────────────────────────────────────────────────────────

export type CompanyJobRow = {
  id: string;
  slug: string;
  title: string;
  status: JobStatus;
  reviewNote: string | null;
  location: string | null;
  postedAt: Date;
  expiresAt: Date | null;
  applicationCount: number;
  viewCount: number;
  newApplicants: number;
};

export async function listCompanyJobs(companyIds: string[]): Promise<(CompanyJobRow & { companyId: string })[]> {
  if (companyIds.length === 0) return [];
  return db
    .select({
      id: jobs.id,
      companyId: sql<string>`${jobs.companyId}`,
      slug: jobs.slug,
      title: jobs.title,
      status: jobs.status,
      reviewNote: jobs.reviewNote,
      location: jobs.location,
      postedAt: jobs.postedAt,
      expiresAt: jobs.expiresAt,
      applicationCount: jobs.applicationCount,
      viewCount: jobs.viewCount,
      newApplicants: sql<number>`(select count(*)::int from ${jobApplications} where ${jobApplications.jobId} = ${jobs.id} and ${jobApplications.status} = 'submitted')`,
    })
    .from(jobs)
    .where(and(inArray(jobs.companyId, companyIds), eq(jobs.source, "direct")))
    .orderBy(sql`case ${jobs.status} when 'active' then 0 when 'pending_review' then 1 when 'draft' then 2 else 3 end`, desc(jobs.postedAt))
    .limit(300);
}

export type Applicant = {
  id: string;
  status: ApplicationStatus;
  coverNote: string | null;
  recruiterNote: string | null;
  resumeFileId: string | null;
  createdAt: Date;
  candidate: {
    id: string;
    username: string;
    name: string;
    headline: string | null;
    avatarFileId: string | null;
    location: string | null;
    yearsExperience: number | null;
    skills: string[];
  };
};

/** Applicants for a listing. Callers must have checked company membership first. */
export async function listApplicants(jobId: string): Promise<Applicant[]> {
  const rows = await db
    .select({
      id: jobApplications.id,
      status: jobApplications.status,
      coverNote: jobApplications.coverNote,
      recruiterNote: jobApplications.recruiterNote,
      resumeFileId: jobApplications.resumeFileId,
      createdAt: jobApplications.createdAt,
      userId: users.id,
      username: users.username,
      name: users.name,
      headline: profiles.headline,
      avatarFileId: profiles.avatarFileId,
      location: profiles.location,
      yearsExperience: profiles.yearsExperience,
      skills: profiles.skills,
    })
    .from(jobApplications)
    .innerJoin(users, eq(users.id, jobApplications.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(jobApplications.jobId, jobId), ne(jobApplications.status, "withdrawn"), eq(users.status, "active")))
    .orderBy(desc(jobApplications.createdAt))
    .limit(500);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    coverNote: row.coverNote,
    recruiterNote: row.recruiterNote,
    resumeFileId: row.resumeFileId,
    createdAt: row.createdAt,
    candidate: {
      id: row.userId,
      username: row.username,
      name: row.name,
      headline: row.headline,
      avatarFileId: row.avatarFileId,
      location: row.location,
      yearsExperience: row.yearsExperience,
      skills: row.skills ?? [],
    },
  }));
}

export type CandidateFilters = { q?: string; skills?: string[]; domain?: string; country?: string; openToWork?: boolean; page?: number };

export type CandidateCard = {
  id: string;
  username: string;
  name: string;
  headline: string | null;
  avatarFileId: string | null;
  location: string | null;
  country: string | null;
  yearsExperience: number | null;
  skills: string[];
  domains: string[];
  openToWork: boolean;
};

/**
 * Candidate discovery for recruiters at verified organisations. Only members who explicitly
 * opted in (`recruiterDiscoverable`) and whose profile is not connections-only are returned.
 */
export async function searchCandidates(filters: CandidateFilters, pageSize = 20): Promise<{ items: CandidateCard[]; total: number; hasMore: boolean; page: number }> {
  const where: SQL[] = [eq(users.status, "active"), eq(profiles.recruiterDiscoverable, true), ne(profiles.visibility, "private"), sql`${users.onboardedAt} is not null`];
  const q = filters.q?.trim().slice(0, 80);
  if (q) where.push(or(ilike(users.name, likePattern(q)), ilike(profiles.headline, likePattern(q)), ilike(profiles.currentTitle, likePattern(q)))!);
  if (filters.skills?.length) where.push(arrayOverlaps(profiles.skills, filters.skills));
  if (filters.domain) where.push(arrayOverlaps(profiles.domains, [filters.domain]));
  if (filters.country) where.push(eq(profiles.country, filters.country));
  if (filters.openToWork) where.push(eq(profiles.openToWork, true));
  const page = Math.min(Math.max(filters.page ?? 1, 1), 100);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        name: users.name,
        headline: profiles.headline,
        avatarFileId: profiles.avatarFileId,
        location: profiles.location,
        country: profiles.country,
        yearsExperience: profiles.yearsExperience,
        skills: profiles.skills,
        domains: profiles.domains,
        openToWork: profiles.openToWork,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(and(...where))
      .orderBy(desc(profiles.openToWork), desc(profiles.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(...where)),
  ]);
  return { items: rows, total: total?.value ?? 0, hasMore: page * pageSize < (total?.value ?? 0), page };
}
