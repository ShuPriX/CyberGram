import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/auth/tokens";
import { env } from "@/lib/env";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { runScheduledWork } from "@/server/services/scheduled-work";

export const dynamic = "force-dynamic";
// Synchronising several feeds can take a while; allow the platform's maximum.
export const maxDuration = 300;

/**
 * Entry point for an external scheduler (cron, a platform's scheduled functions, a CI job).
 * Call it at least once a day — hourly is fine: every step is idempotent and each job source
 * only syncs when it is due.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily
 */
async function handle(request: NextRequest) {
  if (!env.CRON_SECRET) return NextResponse.json({ error: "Scheduled work is not configured (CRON_SECRET is unset)." }, { status: 503 });

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  // A leaked or misconfigured scheduler must not be able to hammer upstream job boards.
  const limit = await rateLimit("generic", "cron");
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });

  const report = await runScheduledWork("schedule");
  await audit("system.scheduled_work", { metadata: { sources: report.sync.length, expired: report.expiredJobs, alerts: report.alertsSent, errors: report.errors.length } });
  return NextResponse.json(report, { status: report.errors.length > 0 ? 207 : 200, headers: { "Cache-Control": "no-store" } });
}

export const POST = handle;
// Some schedulers can only issue GET requests; the bearer token is still required.
export const GET = handle;
