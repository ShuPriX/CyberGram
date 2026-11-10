import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { db } from "./index";

const migrationsFolder = path.resolve(process.cwd(), "drizzle");

/** Applies any pending SQL migrations from ./drizzle. Safe to call repeatedly. */
export async function runMigrations(): Promise<void> {
  if (env.isEmbeddedDb) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // Both drivers share the query-builder surface the migrator relies on.
    await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder });
  }
}
