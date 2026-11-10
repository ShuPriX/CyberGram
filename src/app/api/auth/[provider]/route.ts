import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { IS_SECURE_ORIGIN, OAUTH_STATE_COOKIE } from "@/lib/auth/cookie-name";
import { authorizationUrl, isOAuthProvider, isProviderConfigured } from "@/lib/auth/oauth";
import { generateToken } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { safeRedirectPath } from "@/lib/utils";

/** Starts an OAuth sign-in: stores state + PKCE verifier in a short-lived cookie and redirects. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const loginUrl = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, env.APP_URL));

  if (!isOAuthProvider(provider) || !isProviderConfigured(provider)) return loginUrl("oauth_unavailable");

  const { ip } = await getRequestMeta();
  if (!(await rateLimit("oauth", ip)).ok) return loginUrl("rate_limited");

  const state = generateToken(24);
  const verifier = generateToken(48);
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "");

  (await cookies()).set(OAUTH_STATE_COOKIE, Buffer.from(JSON.stringify({ provider, state, verifier, next })).toString("base64url"), {
    httpOnly: true,
    secure: IS_SECURE_ORIGIN,
    // Lax so the cookie is sent on the top-level redirect back from the provider.
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(authorizationUrl(provider, state, verifier));
}
