import "./_env";

/**
 * Database seeding.
 *
 *   npm run db:seed          reference data + the administrator from SEED_ADMIN_EMAIL/PASSWORD
 *   npm run db:seed:demo     additionally creates clearly-labelled demo members and content
 *   npm run db:purge-demo    removes everything the demo seed created
 *
 * Demo data is refused in production: the platform must never present invented people or
 * job listings as real.
 */
async function main() {
  const args = new Set(process.argv.slice(2));
  const { runMigrations } = await import("../src/db/migrate");
  const { closeDb } = await import("../src/db");
  const { seedBase } = await import("../src/db/seed/base");
  const { seedAdmin } = await import("../src/db/seed/admin");

  await runMigrations();

  if (args.has("--purge-demo")) {
    const { purgeDemo } = await import("../src/db/seed/demo");
    const removed = await purgeDemo();
    console.log(`✓ Removed demo data (${removed.users} members, ${removed.companies} companies, ${removed.jobs} jobs).`);
    await closeDb();
    return;
  }

  await seedBase();
  console.log("✓ Reference data installed (categories, communities, roadmaps, curated resources).");

  const admin = await seedAdmin();
  console.log(admin.created ? `✓ Administrator created: ${admin.email}` : `• Administrator already exists: ${admin.email}`);

  if (args.has("--demo")) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Demo data cannot be created in production.");
    }
    const { seedDemo } = await import("../src/db/seed/demo");
    const result = await seedDemo();
    console.log(`✓ Demo data created (${result.users} members, ${result.posts} posts, ${result.jobs} jobs) — all labelled as demo.`);
    console.log("  Sign in as any demo member with the password in SEED_DEMO_PASSWORD (.env.local).");
  }

  await closeDb();
}

main().catch((err) => {
  console.error("Seeding failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
