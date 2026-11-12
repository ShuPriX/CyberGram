import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, companyMembers, files, profiles, type FileKind } from "@/db/schema";
import type { CompanyMemberRole } from "@/lib/constants";
import { ActionError } from "@/server/action-utils";

/**
 * Confirms an uploaded file belongs to the caller and was uploaded for this purpose.
 * Returns the id (or null when nothing was supplied) and throws a user-safe error otherwise.
 */
export async function ownedFileId(userId: string, fileId: string | undefined | null, kind: FileKind): Promise<string | null> {
  if (!fileId) return null;
  const [file] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.ownerId, userId), eq(files.kind, kind)))
    .limit(1);
  if (!file) throw new ActionError("That file could not be used. Please upload it again.");
  return file.id;
}

export type CompanyAccess = {
  company: typeof companies.$inferSelect;
  role: CompanyMemberRole;
};

/**
 * What a member may do for an organisation is decided here, from `company_members` — never
 * from the platform role alone. `manage` is limited to owners and admins.
 */
export async function getCompanyAccess(userId: string, where: { id: string } | { slug: string }): Promise<CompanyAccess | null> {
  const [row] = await db
    .select({ company: companies, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, userId), "id" in where ? eq(companies.id, where.id) : eq(companies.slug, where.slug)))
    .limit(1);
  return row ?? null;
}

export async function requireCompanyAccess(userId: string, companyId: string, level: "member" | "manage" = "member"): Promise<CompanyAccess> {
  const access = await getCompanyAccess(userId, { id: companyId });
  if (!access) throw new ActionError("You do not have access to that organisation.");
  if (access.company.status !== "active") throw new ActionError("This organisation is suspended.");
  if (level === "manage" && access.role === "recruiter") throw new ActionError("Only an owner or admin of the organisation can do that.");
  return access;
}

/** Adjusts a denormalised profile counter without letting it go negative. */
export async function bumpProfileCounter(userId: string, column: "followerCount" | "followingCount" | "connectionCount", delta: 1 | -1) {
  await db
    .update(profiles)
    .set({ [column]: sql`greatest(${profiles[column]} + ${delta}, 0)` })
    .where(eq(profiles.userId, userId));
}
