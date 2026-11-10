import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, profiles, users, type AuthTokenType } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { RESERVED_USERNAMES } from "@/lib/constants";
import { env } from "@/lib/env";
import { newId, shortId } from "@/lib/ids";
import { sendMail } from "@/lib/mail";
import { emails } from "@/lib/mail/templates";
import { slugify } from "@/lib/utils";
import { USERNAME_PATTERN } from "@/lib/validation";

const TOKEN_LIFETIME_MS: Record<AuthTokenType, number> = {
  email_verify: 24 * 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
};

/** Derives a unique, non-reserved handle from a display name. Members can change it later. */
export async function generateUsername(name: string, email: string): Promise<string> {
  let base = slugify(name, 24);
  if (base.length < 3) base = slugify(email.split("@")[0] ?? "", 24);
  if (base.length < 3) base = "member";
  if (RESERVED_USERNAMES.has(base)) base = `${base}-sec`;

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 24)}-${shortId(4)}`;
    if (!USERNAME_PATTERN.test(candidate)) continue;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `member-${shortId(10)}`;
}

/** Creates the account and its profile row atomically. */
export async function createAccount(input: {
  email: string;
  name: string;
  passwordHash: string | null;
  emailVerified: boolean;
}): Promise<{ id: string; username: string }> {
  const id = newId();
  const username = await generateUsername(input.name, input.email);
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email: input.email,
      name: input.name,
      username,
      passwordHash: input.passwordHash,
      emailVerifiedAt: input.emailVerified ? new Date() : null,
    });
    await tx.insert(profiles).values({ userId: id });
  });
  return { id, username };
}

/**
 * Issues a single-use token. Any earlier token of the same type for the account is revoked,
 * so only the most recent email link works.
 */
export async function issueAuthToken(userId: string, type: AuthTokenType): Promise<string> {
  const token = generateToken();
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS[type]),
  });
  return token;
}

/** Looks up a live token without consuming it (used to render the confirmation screens). */
export async function findAuthToken(token: string, type: AuthTokenType) {
  if (!token || token.length > 128) return null;
  const [row] = await db
    .select({ id: authTokens.id, userId: authTokens.userId })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Atomically marks a token as used. The conditional UPDATE means two concurrent requests
 * with the same token cannot both succeed.
 */
export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }): Promise<void> {
  const token = await issueAuthToken(user.id, "email_verify");
  await sendMail(emails.verifyEmail(user.email, user.name, `${env.APP_URL}/verify-email?token=${token}`));
}

export async function sendPasswordResetEmail(user: { id: string; email: string }): Promise<void> {
  const token = await issueAuthToken(user.id, "password_reset");
  await sendMail(emails.passwordReset(user.email, `${env.APP_URL}/reset-password?token=${token}`));
}

export async function purgeExpiredAuthTokens(): Promise<number> {
  const removed = await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date())).returning({ id: authTokens.id });
  return removed.length;
}
