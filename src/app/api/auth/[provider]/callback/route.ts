import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/cookie-name";
import { fetchIdentity, isOAuthProvider, isProviderConfigured } from "@/lib/auth/oauth";
import { createSession, revokeUserSessions } from "@/lib/auth/session";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { audit } from "@/lib/security/audit";
import { cleanInline } from "@/lib/text";
import { safeRedirectPath } from "@/lib/utils";
import { createAccount } from "@/server/services/accounts";

type StoredState = { provider: string; state: string; verifier: string; next: string };

function readState(raw: string | undefined): StoredState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as StoredState;
    return typeof parsed.state === "string" && typeof parsed.verifier === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, env.APP_URL));

  const cookieStore = await cookies();
  const stored = readState(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!isOAuthProvider(provider) || !isProviderConfigured(provider)) return to("/login?error=oauth_unavailable");

  const query = request.nextUrl.searchParams;
  if (query.get("error")) return to("/login?error=oauth_denied");

  const code = query.get("code");
  const state = query.get("state");
  // The state parameter binds this callback to the browser that started the flow (CSRF defence).
  if (!code || !state || !stored || stored.provider !== provider || !safeEqual(stored.state, state)) {
    return to("/login?error=oauth_state");
  }

  let identity;
  try {
    identity = await fetchIdentity(provider, code, stored.verifier);
  } catch (err) {
    console.error("[oauth] identity fetch failed", err);
    return to("/login?error=oauth_failed");
  }
  if (!identity.email || !identity.emailVerified) return to("/login?error=oauth_email");

  // 1. Returning member: this provider identity is already linked.
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, identity.providerAccountId)))
    .limit(1);

  let userId = linked?.userId;
  let created = false;

  if (!userId) {
    const [existing] = await db
      .select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.email, identity.email))
      .limit(1);

    if (existing) {
      // 2. An account with this address exists. The provider vouches for the address, so link it.
      if (!existing.emailVerifiedAt) {
        // The existing account was never confirmed, so its password may have been set by
        // someone else (account pre-hijacking). Discard that credential and any sessions.
        await db.update(users).set({ passwordHash: null, emailVerifiedAt: new Date() }).where(eq(users.id, existing.id));
        await revokeUserSessions(existing.id);
      }
      userId = existing.id;
    } else {
      // 3. First visit: create the account, already verified by the provider.
      const name = cleanInline(identity.name ?? identity.email.split("@")[0] ?? "Member").slice(0, 80) || "Member";
      userId = (await createAccount({ email: identity.email, name, passwordHash: null, emailVerified: true })).id;
      created = true;
    }
    await db
      .insert(oauthAccounts)
      .values({ provider, providerAccountId: identity.providerAccountId, userId, email: identity.email })
      .onConflictDoNothing();
  }

  const [user] = await db
    .select({ id: users.id, status: users.status, onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== "active") return to("/login?error=account_unavailable");

  await db.update(users).set({ lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await createSession(user.id);
  await audit(created ? "auth.oauth_register" : "auth.oauth_login", {
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    metadata: { provider },
  });

  return to(safeRedirectPath(stored.next, user.onboardedAt ? "/feed" : "/onboarding"));
}
