import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * OAuth 2.0 authorization-code flow with PKCE for GitHub and Google.
 * Implemented directly against the providers' documented endpoints: two small, auditable
 * requests per sign-in and no third-party auth dependency.
 */
export type OAuthProvider = "github" | "google";

export type OAuthIdentity = {
  providerAccountId: string;
  email: string | null;
  /** Only provider-verified addresses are ever used to create or link an account. */
  emailVerified: boolean;
  name: string | null;
};

const PROVIDERS = {
  github: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scope: "read:user user:email",
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
  },
} as const;

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "github" || value === "google";
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return env.oauth[provider];
}

function credentials(provider: OAuthProvider) {
  return provider === "github"
    ? { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! }
    : { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! };
}

const redirectUri = (provider: OAuthProvider) => `${env.APP_URL}/api/auth/${provider}/callback`;

export function authorizationUrl(provider: OAuthProvider, state: string, codeVerifier: string): string {
  const url = new URL(PROVIDERS[provider].authorizeUrl);
  url.searchParams.set("client_id", credentials(provider).clientId);
  url.searchParams.set("redirect_uri", redirectUri(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PROVIDERS[provider].scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function exchangeCode(provider: OAuthProvider, code: string, codeVerifier: string): Promise<string> {
  const { clientId, clientSecret } = credentials(provider);
  const res = await fetch(PROVIDERS[provider].tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri(provider),
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!res.ok || !body?.access_token) throw new Error(`OAuth token exchange failed (${provider}): ${body?.error ?? res.status}`);
  return body.access_token;
}

async function getJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "CyberGram" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OAuth profile request failed with ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchIdentity(provider: OAuthProvider, code: string, codeVerifier: string): Promise<OAuthIdentity> {
  const accessToken = await exchangeCode(provider, code, codeVerifier);

  if (provider === "github") {
    const [profile, addresses] = await Promise.all([
      getJson<{ id: number; login: string; name: string | null }>("https://api.github.com/user", accessToken),
      getJson<{ email: string; primary: boolean; verified: boolean }[]>("https://api.github.com/user/emails", accessToken),
    ]);
    const primary = addresses.find((a) => a.primary && a.verified) ?? addresses.find((a) => a.verified);
    return {
      providerAccountId: String(profile.id),
      email: primary?.email.toLowerCase() ?? null,
      emailVerified: Boolean(primary),
      name: profile.name ?? profile.login,
    };
  }

  const profile = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string }>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    accessToken,
  );
  return {
    providerAccountId: profile.sub,
    email: profile.email?.toLowerCase() ?? null,
    emailVerified: profile.email_verified === true,
    name: profile.name ?? null,
  };
}
