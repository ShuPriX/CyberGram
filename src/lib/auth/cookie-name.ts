/**
 * Kept dependency-free so the request proxy can share it without pulling in server modules.
 *
 * Over TLS the cookie uses the `__Host-` prefix, which browsers only accept when the cookie is
 * Secure, has Path=/ and no Domain — it cannot be overwritten from a sibling subdomain.
 */
export const IS_SECURE_ORIGIN = (process.env.APP_URL ?? "").startsWith("https://");
export const SESSION_COOKIE = IS_SECURE_ORIGIN ? "__Host-cg_session" : "cg_session";
export const OAUTH_STATE_COOKIE = IS_SECURE_ORIGIN ? "__Host-cg_oauth" : "cg_oauth";

/** Paths that require a signed-in member. Everything else is publicly viewable. */
export const PROTECTED_PREFIXES = [
  "/feed",
  "/onboarding",
  "/profile",
  "/achievements",
  "/network",
  "/messages",
  "/notifications",
  "/bookmarks",
  "/settings",
  "/recruiter",
  "/admin",
  "/jobs/saved",
  "/jobs/applications",
  "/jobs/alerts",
  "/jobs/submit",
  "/jobs/resumes",
  "/articles/new",
  "/companies/new",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
