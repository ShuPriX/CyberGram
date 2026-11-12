import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { communities, communityMembers, events, resourceVotes, resources, roadmapProgress, roadmaps } from "@/db/schema";
import type { EventType, ResourceLevel, ResourceType } from "@/lib/constants";
import { likePattern } from "./jobs";

export type CommunityCard = typeof communities.$inferSelect & { joined: boolean };

export async function listCommunities(viewerId: string | null): Promise<CommunityCard[]> {
  const [rows, memberships] = await Promise.all([
    db.select().from(communities).orderBy(desc(communities.isOfficial), desc(communities.memberCount), asc(communities.name)).limit(200),
    viewerId ? db.select({ id: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, viewerId)) : [],
  ]);
  const joined = new Set(memberships.map((m) => m.id));
  return rows.map((row) => ({ ...row, joined: joined.has(row.id) }));
}

export async function getCommunity(slug: string, viewerId: string | null): Promise<CommunityCard | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const [row] = await db.select().from(communities).where(eq(communities.slug, slug)).limit(1);
  if (!row) return null;
  const [member] = viewerId
    ? await db.select({ id: communityMembers.userId }).from(communityMembers).where(and(eq(communityMembers.communityId, row.id), eq(communityMembers.userId, viewerId))).limit(1)
    : [];
  return { ...row, joined: Boolean(member) };
}

export async function listUpcomingEvents(options: { type?: string; limit?: number } = {}) {
  const where: SQL[] = [eq(events.status, "approved"), gte(sql`coalesce(${events.endsAt}, ${events.startsAt})`, sql`now() - interval '1 day'`)];
  if (options.type) where.push(eq(events.type, options.type as EventType));
  return db.select().from(events).where(and(...where)).orderBy(asc(events.startsAt)).limit(options.limit ?? 60);
}

export type ResourceFilters = { q?: string; category?: string; type?: string; level?: string; limit?: number };
export type ResourceItem = typeof resources.$inferSelect & { voted: boolean };

export async function listResources(filters: ResourceFilters, viewerId: string | null): Promise<ResourceItem[]> {
  const where: SQL[] = [eq(resources.status, "approved")];
  const q = filters.q?.trim().slice(0, 80);
  if (q) where.push(or(ilike(resources.title, likePattern(q)), ilike(resources.description, likePattern(q)))!);
  if (filters.category) where.push(eq(resources.category, filters.category));
  if (filters.type) where.push(eq(resources.type, filters.type as ResourceType));
  if (filters.level) where.push(eq(resources.level, filters.level as ResourceLevel));
  const rows = await db
    .select()
    .from(resources)
    .where(and(...where))
    .orderBy(desc(resources.upvoteCount), desc(resources.isCurated), asc(resources.title))
    .limit(filters.limit ?? 120);
  const voted =
    viewerId && rows.length > 0
      ? new Set((await db.select({ id: resourceVotes.resourceId }).from(resourceVotes).where(and(eq(resourceVotes.userId, viewerId), inArray(resourceVotes.resourceId, rows.map((r) => r.id))))).map((r) => r.id))
      : new Set<string>();
  return rows.map((row) => ({ ...row, voted: voted.has(row.id) }));
}

export type RoadmapCard = typeof roadmaps.$inferSelect & { completed: number[] };

export async function listRoadmaps(viewerId: string | null): Promise<RoadmapCard[]> {
  const [rows, progress] = await Promise.all([
    db.select().from(roadmaps).orderBy(asc(roadmaps.position), asc(roadmaps.title)),
    viewerId ? db.select().from(roadmapProgress).where(eq(roadmapProgress.userId, viewerId)) : [],
  ]);
  const byRoadmap = new Map(progress.map((p) => [p.roadmapId, p.completedSteps]));
  return rows.map((row) => ({ ...row, completed: byRoadmap.get(row.id) ?? [] }));
}

export async function getRoadmap(slug: string, viewerId: string | null): Promise<RoadmapCard | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const [row] = await db.select().from(roadmaps).where(eq(roadmaps.slug, slug)).limit(1);
  if (!row) return null;
  const [progress] = viewerId
    ? await db.select({ completedSteps: roadmapProgress.completedSteps }).from(roadmapProgress).where(and(eq(roadmapProgress.userId, viewerId), eq(roadmapProgress.roadmapId, row.id))).limit(1)
    : [];
  return { ...row, completed: progress?.completedSteps ?? [] };
}
