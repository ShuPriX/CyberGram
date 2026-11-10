import "./_env";

/** Applies pending database migrations. Run as a release step before starting new code. */
async function main() {
  const { runMigrations } = await import("../src/db/migrate");
  const { closeDb } = await import("../src/db");
  await runMigrations();
  await closeDb();
  console.log("✓ Database is up to date.");
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
