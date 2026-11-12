import "server-only";
import { and, arrayContains, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyFollows, companyMembers, jobs, profiles, users } from "@/db/schema";
import type { CompanyMemberRole, CompanyType } from "@/lib/constants";
import { likePattern, openJobCondition } from "./jobs";

export type CompanyCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  type: CompanyType;
  hqLocation: string | null;
  hqCountry: string | null;
  size: string | null;
  logoFileId: string | null;
  verified: boolean;
  followerCount: number;
  openJobs: number;
  isDemo: boolean;
};

const openJobsCount = sql<number>`(select count(*)::int from ${jobs} where ${jobs.companyId} = ${companies.id} and ${openJobCondition()})`;

const cardColumns = {
  id: companies.id,
  slug: companies.slug,
  name: companies.name,
  tagline: companies.tagline,
  type: companies.type,
  hqLocation: companies.hqLocation,
  hqCountry: companies.hqCountry,
  size: companies.size,
  logoFileId: companies.logoFileId,
  verification: companies.verificationStatus,
  followerCount: companies.followerCount,
  openJobs: openJobsCount,
  isDemo: companies.isDemo,
};

type CardRow = { verification: string } & Omit<CompanyCard, "verified">;
const toCard = ({ verification, ...row }: CardRow): CompanyCard => ({ ...row, verified: verification === "verified" });

export type CompanyFilters = { q?: string; type?: string; specialization?: string; country?: string; hiring?: boolean; verified?: boolean; page?: number };

export async function listCompanies(filters: CompanyFilters = {}, pageSize = 24): Promise<{ items: CompanyCard[]; total: number; hasMore: boolean; page: number }> {
  const where: SQL[] = [eq(companies.status, "active")];
  const q = filters.q?.trim().slice(0, 80);
  if (q) where.push(or(ilike(companies.name, likePattern(q)), ilike(companies.tagline, likePattern(q)))!);
  if (filters.type) where.push(eq(companies.type, filters.type as CompanyType));
  if (filters.specialization) where.push(arrayContains(companies.specializations, [filters.specialization]));
  if (filters.country) where.push(eq(companies.hqCountry, filters.country));
  if (filters.verified) where.push(eq(companies.verificationStatus, "verified"));
  if (filters.hiring) where.push(sql`${openJobsCount} > 0`);
  const page = Math.min(Math.max(filters.page ?? 1, 1), 100);

  const [rows, [total]] = await Promise.all([
    db
      .select(cardColumns)
      .from(companies)
      .where(and(...where))
      .orderBy(sql`(${companies.verificationStatus} = 'verified') desc`, desc(openJobsCount), desc(companies.followerCount), asc(companies.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(companies).where(and(...where)),
  ]);
  return { items: rows.map(toCard), total: total?.value ?? 0, hasMore: page * pageSize < (total?.value ?? 0), page };
}

export async function searchCompanies(q: string, limit = 8): Promise<CompanyCard[]> {
  return (await listCompanies({ q }, limit)).items;
}

export type CompanyTeamMember = { userId: string; username: string; name: string; headline: string | null; avatarFileId: string | null; role: CompanyMemberRole; title: string | null };

export type CompanyDetail = typeof companies.$inferSelect & {
  verified: boolean;
  openJobs: number;
  viewer: { following: boolean; role: CompanyMemberRole | null };
};

export async function getCompanyBySlug(slug: string, viewerId: string | null): Promise<CompanyDetail | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const [row] = await db.select({ company: companies, openJobs: openJobsCount }).from(companies).where(eq(companies.slug, slug)).limit(1);
  if (!row) return null;
  let following = false;
  let role: CompanyMemberRole | null = null;
  if (viewerId) {
    const [[follow], [member]] = await Promise.all([
      db.select({ id: companyFollows.companyId }).from(companyFollows).where(and(eq(companyFollows.companyId, row.company.id), eq(companyFollows.userId, viewerId))).limit(1),
      db.select({ role: companyMembers.role }).from(companyMembers).where(and(eq(companyMembers.companyId, row.company.id), eq(companyMembers.userId, viewerId))).limit(1),
    ]);
    following = Boolean(follow);
    role = member?.role ?? null;
  }
  return { ...row.company, verified: row.company.verificationStatus === "verified", openJobs: row.openJobs, viewer: { following, role } };
}

export async function getCompanyTeam(companyId: string): Promise<CompanyTeamMember[]> {
  return db
    .select({
      userId: users.id,
      username: users.username,
      name: users.name,
      headline: sql<string | null>`case when ${profiles.visibility} = 'public' then ${profiles.headline} end`,
      avatarFileId: profiles.avatarFileId,
      role: companyMembers.role,
      title: companyMembers.title,
    })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(companyMembers.companyId, companyId), eq(users.status, "active")))
    .orderBy(sql`case ${companyMembers.role} when 'owner' then 0 when 'admin' then 1 else 2 end`, asc(users.name));
}

export type MemberCompany = { id: string; slug: string; name: string; logoFileId: string | null; role: CompanyMemberRole; verificationStatus: string; status: string; openJobs: number };

/** Organisations a member can act for, with what they need for the recruiter portal. */
export async function getMemberCompanies(userId: string): Promise<MemberCompany[]> {
  return db
    .select({
      id: companies.id,
      slug: companies.slug,
      name: companies.name,
      logoFileId: companies.logoFileId,
      role: companyMembers.role,
      verificationStatus: companies.verificationStatus,
      status: companies.status,
      openJobs: openJobsCount,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, userId))
    .orderBy(asc(companies.name));
}
