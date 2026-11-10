"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { checkPasswordPolicy, hashPassword, isPasswordBreached, verifyDummyPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, getSession, revokeUserSessions } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { emails } from "@/lib/mail/templates";
import { audit } from "@/lib/security/audit";
import { rateLimit, retryMessage } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { safeRedirectPath } from "@/lib/utils";
import { zBool, zDisplayName, zEmail, zPassword } from "@/lib/validation";
import { fail, ok, publicFormAction } from "@/server/action-utils";
import { consumeAuthToken, createAccount, sendPasswordResetEmail, sendVerificationEmail } from "@/server/services/accounts";

const INVALID_CREDENTIALS = "Incorrect email or password.";
const LOCKED = "Too many failed sign-in attempts. Please wait a few minutes or reset your password.";
const FAILED_ATTEMPTS_BEFORE_LOCK = 8;

/** Lockout grows with continued failures: 15 min, then 30, then 60. */
function lockDuration(failedCount: number): number {
  const step = Math.floor((failedCount - FAILED_ATTEMPTS_BEFORE_LOCK) / 4);
  return Math.min(60, 15 * 2 ** Math.max(0, step)) * 60_000;
}

// ── Registration ─────────────────────────────────────────────────────────────

const registerSchema = z.object({
  name: zDisplayName,
  email: zEmail,
  password: zPassword,
  terms: zBool.refine((v) => v, "Please accept the terms to continue."),
  // Bot deterrents: a field humans never see, and the time the form was rendered.
  website: z.string().optional(),
  renderedAt: z.coerce.number().optional(),
});

/**
 * The response is identical whether or not the address already has an account, so this
 * endpoint cannot be used to discover who is registered. The address owner finds out by email.
 */
export const registerAction = publicFormAction({ schema: registerSchema, rateLimit: "register" }, async (input) => {
  const success = ok("Check your inbox to confirm your email address.");

  const filledTooFast = input.renderedAt !== undefined && Date.now() - input.renderedAt < 1200;
  if (input.website || filledTooFast) return success; // silently drop automated submissions

  const policy = checkPasswordPolicy(input.password, { email: input.email, name: input.name });
  if (!policy.ok) return fail("Please choose a stronger password.", { password: policy.message });
  if (await isPasswordBreached(input.password)) {
    return fail("Please choose a different password.", {
      password: "This password has appeared in a known data breach. Choose one you have not used elsewhere.",
    });
  }

  const passwordHash = await hashPassword(input.password);
  const [existing] = await db
    .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt, status: users.status })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing) {
    if (existing.status !== "active") return success;
    if (existing.emailVerifiedAt) {
      await sendMail(emails.accountExists(input.email, `${env.APP_URL}/login`));
    } else {
      // Nobody has proven ownership of this address yet. The latest registrant's details
      // replace the earlier ones; only whoever controls the mailbox can activate the account.
      await db.update(users).set({ name: input.name, passwordHash }).where(eq(users.id, existing.id));
      await sendVerificationEmail({ id: existing.id, email: input.email, name: input.name });
    }
    return success;
  }

  const account = await createAccount({ email: input.email, name: input.name, passwordHash, emailVerified: false });
  await sendVerificationEmail({ id: account.id, email: input.email, name: input.name });
  await audit("auth.register", { actorId: account.id, targetType: "user", targetId: account.id });
  return success;
});

// ── Sign in / out ────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: zEmail,
  password: zPassword,
  next: z.string().max(500).optional(),
});

export const loginAction = publicFormAction({ schema: loginSchema }, async (input, { ip }) => {
  // Two independent limits: per client address (credential stuffing across accounts) and per
  // target account (distributed guessing against one account).
  const [ipLimit, accountLimit] = await Promise.all([rateLimit("loginIp", ip), rateLimit("loginAccount", input.email)]);
  if (!ipLimit.ok) return fail(retryMessage(ipLimit));
  if (!accountLimit.ok) return fail(LOCKED);

  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  if (!user || !user.passwordHash) {
    await verifyDummyPassword(input.password);
    await audit("auth.login_failed", { metadata: { reason: "unknown_or_passwordless" } });
    return fail(INVALID_CREDENTIALS);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyDummyPassword(input.password);
    return fail(LOCKED);
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedLoginCount + 1;
    const lockedUntil = failed >= FAILED_ATTEMPTS_BEFORE_LOCK ? new Date(Date.now() + lockDuration(failed)) : null;
    await db.update(users).set({ failedLoginCount: failed, lockedUntil }).where(eq(users.id, user.id));
    await audit("auth.login_failed", { actorId: user.id, metadata: { reason: "bad_password", failed, locked: lockedUntil !== null } });
    return fail(INVALID_CREDENTIALS);
  }

  // From here on the caller has proven knowledge of the password, so account state may be disclosed.
  if (user.status === "suspended") {
    return fail("This account has been suspended. Contact us if you believe this is a mistake.");
  }
  if (user.status !== "active") return fail(INVALID_CREDENTIALS);

  if (!user.emailVerifiedAt) {
    const resend = await rateLimit("emailVerification", user.id);
    if (resend.ok) await sendVerificationEmail({ id: user.id, email: user.email, name: user.name });
    return fail("Please confirm your email address before signing in. We have sent you a fresh confirmation link.");
  }

  const meta = await getRequestMeta();
  const [seenBefore] = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, user.id),
        inArray(auditLogs.action, ["auth.login", "auth.oauth_login", "auth.email_verified"]),
        meta.userAgent ? eq(auditLogs.userAgent, meta.userAgent) : undefined,
      ),
    )
    .limit(1);

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  await audit("auth.login", { actorId: user.id, targetType: "user", targetId: user.id });

  if (!seenBefore && user.lastLoginAt) {
    await sendMail(emails.newSignIn(user.email, { ip: meta.ip, userAgent: meta.userAgent, when: new Date() }));
  }

  redirect(safeRedirectPath(input.next, user.onboardedAt ? "/feed" : "/onboarding"));
});

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await destroyCurrentSession();
  if (session) await audit("auth.logout", { actorId: session.user.id });
  redirect("/");
}

// ── Email verification ───────────────────────────────────────────────────────

export const verifyEmailAction = publicFormAction({ schema: z.object({ token: z.string().min(1).max(128) }) }, async (input) => {
  const userId = await consumeAuthToken(input.token, "email_verify");
  if (!userId) return fail("This confirmation link is invalid or has expired. Request a new one below.");

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .returning({ id: users.id, onboardedAt: users.onboardedAt });
  if (!user) return fail("This account is no longer available.");

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  await audit("auth.email_verified", { actorId: user.id, targetType: "user", targetId: user.id });
  redirect(user.onboardedAt ? "/feed" : "/onboarding");
});

export const resendVerificationAction = publicFormAction(
  { schema: z.object({ email: zEmail }), rateLimit: "emailVerification" },
  async (input) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, emailVerifiedAt: users.emailVerifiedAt, status: users.status })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (user && !user.emailVerifiedAt && user.status === "active") await sendVerificationEmail(user);
    return ok("If that address has an unconfirmed account, a new confirmation link is on its way.");
  },
);

// ── Password reset ───────────────────────────────────────────────────────────

export const forgotPasswordAction = publicFormAction(
  { schema: z.object({ email: zEmail }), rateLimit: "passwordReset" },
  async (input) => {
    const [user] = await db
      .select({ id: users.id, email: users.email, status: users.status })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (user && user.status === "active") {
      await sendPasswordResetEmail(user);
      await audit("auth.password_reset_requested", { actorId: user.id });
    }
    return ok("If an account exists for that address, a reset link is on its way. It expires in 30 minutes.");
  },
);

const resetSchema = z
  .object({ token: z.string().min(1).max(128), password: zPassword, confirm: zPassword })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match." });

export const resetPasswordAction = publicFormAction({ schema: resetSchema, rateLimit: "passwordReset" }, async (input) => {
  const policy = checkPasswordPolicy(input.password);
  if (!policy.ok) return fail("Please choose a stronger password.", { password: policy.message });
  if (await isPasswordBreached(input.password)) {
    return fail("Please choose a different password.", {
      password: "This password has appeared in a known data breach. Choose one you have not used elsewhere.",
    });
  }

  const passwordHash = await hashPassword(input.password);
  const userId = await consumeAuthToken(input.token, "password_reset");
  if (!userId) return fail("This reset link is invalid or has expired. Request a new one.");

  const [user] = await db
    .update(users)
    .set({
      passwordHash,
      failedLoginCount: 0,
      lockedUntil: null,
      // Completing a reset proves control of the mailbox.
      emailVerifiedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .returning({ id: users.id, email: users.email });
  if (!user) return fail("This account is no longer available.");

  // Anyone who was signed in — including an attacker — is signed out everywhere.
  await revokeUserSessions(user.id);
  await audit("auth.password_reset", { actorId: user.id, targetType: "user", targetId: user.id });
  await sendMail(emails.passwordChanged(user.email));
  redirect("/login?reset=1");
});
