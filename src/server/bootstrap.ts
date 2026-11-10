import "server-only";
import { runMigrations } from "@/db/migrate";
import { needsBaseSeed, seedBase } from "@/db/seed/base";
import { env } from "@/lib/env";

const globalStore = globalThis as unknown as { __cybergramBooted?: Promise<void> };

async function boot(): Promise<void> {
  // The embedded development database is migrated automatically. Against PostgreSQL,
  // migrations are an explicit release step (`npm run db:migrate`) unless AUTO_MIGRATE is set,
  // so that several instances starting at once never race each other.
  if (env.isEmbeddedDb || env.AUTO_MIGRATE) {
    await runMigrations();
    if (await needsBaseSeed()) await seedBase();
  }

  if (env.isProd && !env.SMTP_URL) {
    console.warn("[boot] SMTP_URL is not set: verification and notification emails will not be delivered.");
  }
  if (env.isProd && env.isEmbeddedDb) {
    console.warn("[boot] DATABASE_URL is not set: running production on the embedded database is not supported.");
  }

  if (env.ENABLE_INTERNAL_SCHEDULER) {
    const { startScheduler } = await import("@/server/services/scheduler");
    startScheduler();
  }
}

/** Runs once per server process, before the first request is served. */
export function bootstrap(): Promise<void> {
  return (globalStore.__cybergramBooted ??= boot());
}
