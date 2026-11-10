import "server-only";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { purgeExpiredAuthTokens } from "./accounts";
import { expireStaleJobs, runJobAlerts, syncDueSources, type SyncReport } from "./job-sync";

export type ScheduledWorkReport = {
  startedAt: string;
  finishedAt: string;
  sync: SyncReport[];
  expiredJobs: number;
  alertsSent: number;
  sessionsPurged: number;
  tokensPurged: number;
  errors: string[];
};

/**
 * Everything that runs on a schedule: job-feed synchronisation, expiry of stale listings, job
 * alerts and housekeeping. Each step is independent — one failing never blocks the others —
 * and each is idempotent, so running this more often than daily is safe.
 */
export async function runScheduledWork(trigger: "schedule" | "manual"): Promise<ScheduledWorkReport> {
  const startedAt = new Date();
  const errors: string[] = [];
  const step = async <T>(name: string, fallback: T, work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (err) {
      console.error(`[scheduled] ${name} failed`, err);
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      return fallback;
    }
  };

  const sync = await step("job sync", [] as SyncReport[], () => syncDueSources(trigger));
  const expiredJobs = await step("job expiry", 0, expireStaleJobs);
  const alertsSent = await step("job alerts", 0, runJobAlerts);
  const sessionsPurged = await step("session cleanup", 0, purgeExpiredSessions);
  const tokensPurged = await step("token cleanup", 0, purgeExpiredAuthTokens);

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    sync,
    expiredJobs,
    alertsSent,
    sessionsPurged,
    tokensPurged,
    errors,
  };
}
