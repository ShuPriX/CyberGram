import "./_env";

/**
 * Runs scheduled work from the command line — for a system cron entry, a container job or a
 * one-off manual run. Equivalent to calling POST /api/cron/daily.
 *
 *   npm run cron:daily     job-feed sync, listing expiry, job alerts and housekeeping
 *   npm run jobs:sync      synchronise every enabled job source now, ignoring schedules
 *   npm run news:sync      refresh the security news desk now
 *   npm run social:post    post the next card to Instagram now (add --dry to preview, --force to ignore the daily pace)
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

  if (mode === "news") {
    const { syncNews } = await import("../src/server/services/news-sync");
    const report = await syncNews();
    console.log(`✓ News desk: ${report.added} new headlines from ${report.sources} sources, ${report.posted} published to the feed.`);
    for (const failure of report.failed) console.error(`✗ ${failure}`);
    await closeDb();
    return;
  }

  if (mode === "social") {
    const { runInstagramPosting } = await import("../src/server/services/social-poster");
    const report = await runInstagramPosting({ dryRun: process.argv.includes("--dry"), force: process.argv.includes("--force") });
    if (report.status === "dry-run") console.log(`Would post ${report.key}:

${report.caption}

${JSON.stringify(report.payload, null, 2)}`);
    else if (report.status === "published") console.log(`✓ Published ${report.key} to Instagram (media ${report.externalId}).`);
    else if (report.status === "failed") console.error(`✗ ${report.key}: ${report.error}`);
    else console.log(`Nothing posted: ${report.reason}.`);
    await closeDb();
    if (report.status === "failed") process.exit(1);
    return;
  }

  if (mode !== "daily") throw new Error(`Unknown mode "${mode}". Use "daily", "sync", "news" or "social".`);
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
