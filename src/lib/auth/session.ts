import "server-only";
import { and, eq, lt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { profiles, sessions, users } from "@/db/schema";
import type { Role } from "@/lib/constants";
import { getRequestMeta } from "@/lib/security/request";
import { IS_SECURE_ORIGIN, SESSION_COOKIE } from "./cookie-name";
import { can, type Capability } from "./permissions";
import { generateToken, hashToken } from "./tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_LIFETIME_MS = 30 * DAY_MS;
/** Sessions used within this window of expiry are extended (sliding expiration). */
const RENEW_WHEN_REMAINING_MS = 15 * DAY_MS;
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  onboarded: boolean;
  avatarFileId: string | null;
  headline: string | null;
};

export type SessionContext = { sessionId: string; user: SessionUser };

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: IS_SECURE_ORIGIN,
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Creates a server-side session and sets the cookie. Call from actions / route handlers only. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  const meta = await getRequestMeta();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Resolves the current session. Memoised per request, so layouts, pages and components can
 * all call it freely at the cost of a single query.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;

  const sessionId = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      lastUsedAt: sessions.lastUsedAt,
      id: users.id,
      email: users.email,
      username: users.username,
      name: users.name,
      role: users.role,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardedAt: users.onboardedAt,
      avatarFileId: profiles.avatarFileId,
      headline: profiles.headline,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now || row.status !== "active") {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  if (row.expiresAt.getTime() - now < RENEW_WHEN_REMAINING_MS) {
    const expiresAt = new Date(now + SESSION_LIFETIME_MS);
    await db.update(sessions).set({ expiresAt, lastUsedAt: new Date(now) }).where(eq(sessions.id, sessionId));
    try {
      // Cookies are writable in actions and route handlers; during a server render this throws
      // and the cookie is simply refreshed on the member's next mutation.
      cookieStore.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
    } catch {
      /* read-only context */
    }
  } else if (now - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastUsedAt: new Date(now) }).where(eq(sessions.id, sessionId));
  }

  return {
    sessionId,
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      name: row.name,
      role: row.role,
      emailVerified: row.emailVerifiedAt !== null,
      onboarded: row.onboardedAt !== null,
      avatarFileId: row.avatarFileId,
      headline: row.headline,
    },
  };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

async function loginRedirectTarget(): Promise<string> {
  try {
    const path = (await headers()).get("x-cg-path");
    if (path && path.startsWith("/") && !path.startsWith("//")) return `/login?next=${encodeURIComponent(path)}`;
  } catch {
    /* outside a request */
  }
  return "/login";
}

/** For pages: returns the signed-in member or redirects to sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(await loginRedirectTarget());
  return user;
}

/** For pages that need a completed profile (most of the app). */
export async function requireOnboardedUser(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  return user;
}

/** For admin pages: 404-equivalent redirect for anyone without the capability. */
export async function requireCapability(capability: Capability): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, capability)) redirect("/feed");
  return user;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  cookieStore.delete(SESSION_COOKIE);
}

/** Revokes every session for a user, optionally keeping the one making the request. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<number> {
  const removed = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return removed.length;
}
