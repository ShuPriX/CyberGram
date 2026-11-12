import "./_env";

/**
 * Runs scheduled work from the command line — for a system cron entry, a container job or a
 * one-off manual run. Equivalent to calling POST /api/cron/daily.
 *
 *   npm run cron:daily     job-feed sync, listing expiry, job alerts and housekeeping
 *   npm run jobs:sync      synchronise every enabled job source now, ignoring schedules
 */
async function main() {
  const mode = process.argv[2] ?? "daily";
  const { closeDb } = await import("../src/db");

  if (mode === "sync") {
    const { db } = await import("../src/db");
    const { jobSources } = await import("../src/db/schema");
    const { eq } = await import("drizzle-orm");
    const { syncSource, expireStaleJobs } = await import("../src/server/services/job-sync");
    const sources = await db.select({ id: jobSources.id, name: jobSources.name }).from(jobSources).where(eq(jobSources.enabled, true));
    if (sources.length === 0) console.log("No enabled job sources. Add one under Admin → Job sources.");
    let failed = 0;
    for (const source of sources) {
      const report = await syncSource(source.id, "manual");
      if (report.status === "failed") failed++;
      console.log(
        `${report.status === "failed" ? "✗" : "✓"} ${source.name}: ${report.status} — fetched ${report.fetched}, new ${report.created}, updated ${report.updated}, closed ${report.expired}, skipped ${report.skipped + report.duplicates}` +
          (report.error ? ` (${report.error})` : ""),
      );
    }
    console.log(`✓ Expired ${await expireStaleJobs()} stale listings.`);
    await closeDb();
    if (failed > 0) process.exit(1);
    return;
  }

  if (mode !== "daily") throw new Error(`Unknown mode "${mode}". Use "daily" or "sync".`);
  const { runScheduledWork } = await import("../src/server/services/scheduled-work");
  const report = await runScheduledWork("schedule");
  console.log(
    `✓ Scheduled work finished: ${report.sync.length} sources synchronised, ${report.expiredJobs} listings expired, ${report.alertsSent} alerts sent, ` +
      `${report.sessionsPurged} sessions and ${report.tokensPurged} tokens purged.`,
  );
  for (const error of report.errors) console.error(`✗ ${error}`);
  await closeDb();
  if (report.errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Scheduled work failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
