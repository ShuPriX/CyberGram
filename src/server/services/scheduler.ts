import "server-only";
import { runScheduledWork } from "./scheduled-work";

const TICK_MS = 15 * 60 * 1000;
const globalStore = globalThis as unknown as { __cybergramScheduler?: ReturnType<typeof setInterval> };

/**
 * Optional in-process scheduler for single-instance deployments (ENABLE_INTERNAL_SCHEDULER).
 * All work is driven by due-dates stored in the database and guarded by leases, so a tick that
 * overlaps with the external cron endpoint — or another instance — is harmless.
 */
export function startScheduler(): void {
  if (globalStore.__cybergramScheduler) return;
  const tick = () => {
    runScheduledWork("schedule").catch((err) => console.error("[scheduler] tick failed", err));
  };
  globalStore.__cybergramScheduler = setInterval(tick, TICK_MS);
  globalStore.__cybergramScheduler.unref?.();
  setTimeout(tick, 30_000).unref?.();
  console.info("[scheduler] internal scheduler started (15 minute tick)");
}
