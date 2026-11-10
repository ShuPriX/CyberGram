import "server-only";
import { and, arrayOverlaps, asc, desc, eq, ilike, inArray, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { achievements, companyMembers, connections, educations, experiences, follows, profiles, projects, users } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import type { Role } from "@/lib/constants";
import { likePattern } from "./jobs";

export type PersonCard = {
  id: string;
  username: string;
  name: string;
  headline: string | null;
  avatarFileId: string | null;
  location: string | null;
};

const personColumns = {
  id: users.id,
  username: users.username,
  name: users.name,
  headline: profiles.headline,
  avatarFileId: profiles.avatarFileId,
  location: profiles.location,
};

export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export type Relationship = {
  isSelf: boolean;
  following: boolean;
  followsYou: boolean;
  connection: "none" | "pending_sent" | "pending_received" | "connected";
  connectionId: string | null;
};

export async function getRelationship(viewerId: string | null, otherId: string): Promise<Relationship> {
  if (!viewerId) return { isSelf: false, following: false, followsYou: false, connection: "none", connectionId: null };
  if (viewerId === otherId) return { isSelf: true, following: false, followsYou: false, connection: "none", connectionId: null };
  const [followRows, [connection]] = await Promise.all([
    db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        or(
          and(eq(follows.followerId, viewerId), eq(follows.followingId, otherId)),
          and(eq(follows.followerId, otherId), eq(follows.followingId, viewerId)),
        ),
      ),
    db.select().from(connections).where(eq(connections.pairKey, pairKey(viewerId, otherId))).limit(1),
  ]);
  let state: Relationship["connection"] = "none";
  if (connection?.status === "accepted") state = "connected";
  else if (connection?.status === "pending") state = connection.requesterId === viewerId ? "pending_sent" : "pending_received";
  return {
    isSelf: false,
    following: followRows.some((r) => r.followerId === viewerId),
    followsYou: followRows.some((r) => r.followerId === otherId),
    connection: state,
    connectionId: connection?.id ?? null,
  };
}

export type ProfileAccess = "full" | "limited";

export type FullProfile = {
  user: { id: string; username: string; name: string; email: string; role: Role; createdAt: Date };
  profile: typeof profiles.$inferSelect;
  relationship: Relationship;
  /** `limited` when the viewer may only see the name card (privacy settings). */
  access: ProfileAccess;
  /** Whether the Open to Work badge may be shown to this viewer. */
  showOpenToWork: boolean;
  experiences: (typeof experiences.$inferSelect)[];
  educations: (typeof educations.$inferSelect)[];
  projects: (typeof projects.$inferSelect)[];
  achievements: (typeof achievements.$inferSelect)[];
};

/** Recruiter status that unlocks recruiter-only signals: membership of a *verified* company. */
export async function isVerifiedRecruiter(userId: string): Promise<boolean> {
  const [row] = await db.execute<{ ok: number }>(sql`
    select 1 as ok from company_members cm
    inner join companies c on c.id = cm.company_id
    where cm.user_id = ${userId} and c.verification_status = 'verified' and c.status = 'active'
    limit 1
  `).then((r) => r.rows);
  return Boolean(row);
}

/**
 * Loads a profile with the owner's privacy settings applied for this viewer:
 * - public: everyone
 * - members: signed-in members only
 * - private: connections only
 * Staff see profiles in full for moderation. Sections are simply absent when access is limited.
 */
export async function getProfileByUsername(username: string, viewer: { id: string; role: Role } | null): Promise<FullProfile | null> {
  if (!/^[a-z0-9_-]{3,30}$/.test(username)) return null;
  const [row] = await db
    .select({ user: users, profile: profiles })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.username, username), eq(users.status, "active")))
    .limit(1);
  if (!row) return null;

  const relationship = await getRelationship(viewer?.id ?? null, row.user.id);
  const staff = can(viewer?.role, "moderate:content");
  const { visibility } = row.profile;
  const full =
    relationship.isSelf ||
    staff ||
    visibility === "public" ||
    (visibility === "members" && viewer !== null) ||
    (visibility === "private" && relationship.connection === "connected");

  const base = {
    user: { id: row.user.id, username: row.user.username, name: row.user.name, email: row.user.email, role: row.user.role, createdAt: row.user.createdAt },
    profile: row.profile,
    relationship,
  };
  if (!full) {
    return { ...base, access: "limited", showOpenToWork: false, experiences: [], educations: [], projects: [], achievements: [] };
  }

  const showOpenToWork =
    row.profile.openToWork &&
    (relationship.isSelf || row.profile.openToWorkVisibility === "public" || (viewer !== null && (await isVerifiedRecruiter(viewer.id))));

  const [experienceRows, educationRows, projectRows, achievementRows] = await Promise.all([
    db.select().from(experiences).where(eq(experiences.userId, row.user.id)).orderBy(desc(experiences.isCurrent), desc(experiences.startDate)),
    db.select().from(educations).where(eq(educations.userId, row.user.id)).orderBy(desc(educations.endYear), desc(educations.startYear)),
    db.select().from(projects).where(eq(projects.userId, row.user.id)).orderBy(desc(projects.createdAt)),
    db.select().from(achievements).where(eq(achievements.userId, row.user.id)).orderBy(desc(achievements.featured), desc(achievements.achievedOn), desc(achievements.createdAt)),
  ]);

  return { ...base, access: "full", showOpenToWork, experiences: experienceRows, educations: educationRows, projects: projectRows, achievements: achievementRows };
}

/** People the viewer is not yet following or connected with, ranked by shared interests. */
export async function getSuggestedPeople(viewerId: string, limit = 5): Promise<PersonCard[]> {
  const [me] = await db.select({ domains: profiles.domains, skills: profiles.skills }).from(profiles).where(eq(profiles.userId, viewerId)).limit(1);
  const known = sql`(
    select ${follows.followingId} from ${follows} where ${follows.followerId} = ${viewerId}
    union
    select case when ${connections.requesterId} = ${viewerId} then ${connections.addresseeId} else ${connections.requesterId} end
    from ${connections} where ${connections.requesterId} = ${viewerId} or ${connections.addresseeId} = ${viewerId}
  )`;
  const affinity: SQL =
    me && (me.domains.length > 0 || me.skills.length > 0)
      ? sql`(case when ${arrayOverlaps(profiles.domains, me.domains.length ? me.domains : [""])} then 2 else 0 end
           + case when ${arrayOverlaps(profiles.skills, me.skills.length ? me.skills : [""])} then 1 else 0 end)`
      : sql`0`;
  return db
    .select(personColumns)
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(users.status, "active"),
        ne(users.id, viewerId),
        sql`${users.onboardedAt} is not null`,
        ne(profiles.visibility, "private"),
        sql`${users.id} not in ${known}`,
      ),
    )
    .orderBy(desc(affinity), desc(profiles.followerCount), desc(users.createdAt))
    .limit(limit);
}

export type ConnectionListItem = PersonCard & { connectionId: string; note: string | null; since: Date };

export async function listConnections(userId: string, limit = 200): Promise<ConnectionListItem[]> {
  const other = sql<string>`case when ${connections.requesterId} = ${userId} then ${connections.addresseeId} else ${connections.requesterId} end`;
  return db
    .select({ ...personColumns, connectionId: connections.id, note: connections.note, since: sql<Date>`coalesce(${connections.respondedAt}, ${connections.createdAt})`.mapWith(connections.createdAt) })
    .from(connections)
    .innerJoin(users, eq(users.id, other))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(connections.status, "accepted"), or(eq(connections.requesterId, userId), eq(connections.addresseeId, userId)), eq(users.status, "active")))
    .orderBy(asc(users.name))
    .limit(limit);
}

export async function listConnectionRequests(userId: string, direction: "received" | "sent"): Promise<ConnectionListItem[]> {
  const mine = direction === "received" ? connections.addresseeId : connections.requesterId;
  const theirs = direction === "received" ? connections.requesterId : connections.addresseeId;
  return db
    .select({ ...personColumns, connectionId: connections.id, note: connections.note, since: connections.createdAt })
    .from(connections)
    .innerJoin(users, eq(users.id, theirs))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(connections.status, "pending"), eq(mine, userId), eq(users.status, "active")))
    .orderBy(desc(connections.createdAt))
    .limit(100);
}

export async function listFollowing(userId: string, limit = 100): Promise<PersonCard[]> {
  return db
    .select(personColumns)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(follows.followerId, userId), eq(users.status, "active")))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
}

export async function listFollowers(userId: string, limit = 100): Promise<PersonCard[]> {
  return db
    .select(personColumns)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(follows.followingId, userId), eq(users.status, "active")))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
}

/** Member search for the global search page. Private profiles are not listed. */
export async function searchPeople(q: string, limit = 20, excludeIds: string[] = []): Promise<PersonCard[]> {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  const pattern = likePattern(term);
  return db
    .select(personColumns)
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(users.status, "active"),
        sql`${users.onboardedAt} is not null`,
        ne(profiles.visibility, "private"),
        or(ilike(users.name, pattern), ilike(users.username, pattern), ilike(profiles.headline, pattern), ilike(profiles.currentCompany, pattern)),
        excludeIds.length > 0 ? notInArray(users.id, excludeIds) : undefined,
      ),
    )
    .orderBy(desc(profiles.followerCount), asc(users.name))
    .limit(limit);
}

export async function getPeopleByIds(ids: string[]): Promise<PersonCard[]> {
  if (ids.length === 0) return [];
  return db.select(personColumns).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(inArray(users.id, ids));
}

/** Organisations a member can act for (post as, publish jobs for, manage). */
export async function getMemberCompanyIds(userId: string): Promise<string[]> {
  const rows = await db.select({ companyId: companyMembers.companyId }).from(companyMembers).where(eq(companyMembers.userId, userId));
  return rows.map((r) => r.companyId);
}
