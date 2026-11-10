import { NextResponse, type NextRequest } from "next/server";
import { IS_SECURE_ORIGIN, isProtectedPath, SESSION_COOKIE } from "@/lib/auth/cookie-name";

/**
 * Runs before every page request.
 *
 * 1. Issues a per-request nonce and a strict Content-Security-Policy. Scripts only run if they
 *    carry the nonce (or are loaded by one that does), so injected markup cannot execute.
 * 2. Sends visitors without a session cookie to sign-in before protected pages render. This
 *    is a fast path only — every page and action re-validates the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtectedPath(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    // 'unsafe-eval' is required by the development toolchain only and is never sent in production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style *attributes* are used for dynamic sizing; they cannot execute script.
    `style-src 'self' 'unsafe-inline'`,
    // No third-party images: avatars and media are always served from our own origin.
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `media-src 'self' blob:`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
    ...(IS_SECURE_ORIGIN ? [`upgrade-insecure-requests`] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-cg-path", pathname + search);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only. API routes set their own headers; static assets need none of this.
      source: "/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|opengraph-image).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
