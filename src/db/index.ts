import "server-only";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Database access.
 *
 * - With `DATABASE_URL` set, queries go to PostgreSQL through a `pg` connection pool.
 * - Without it, an embedded PGlite instance (real Postgres compiled to WASM, persisted in
 *   ./.data/pglite) is used so the project runs with zero external services in development.
 *
 * Both drivers expose the same Drizzle query-builder API, so application code never branches.
 * The client is created lazily on first use: importing this module (e.g. during `next build`)
 * never opens a connection.
 */
export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Accepts either the root database or an open transaction. */
export type Executor = DB | Tx;

type Instance = { db: DB; close: () => Promise<void> };

const globalStore = globalThis as unknown as { __cybergramDb?: Instance };

function embeddedDir(): string {
  return path.resolve(process.cwd(), env.PGLITE_DIR ?? ".data/pglite");
}

/**
 * PGlite is single-process. A second process opening the same directory corrupts it, so we
 * hold a pid lock and fail loudly instead.
 */
function acquireEmbeddedLock(dir: string): () => void {
  const lockFile = `${dir}.lock`;
  if (existsSync(lockFile)) {
    const pid = Number(readFileSync(lockFile, "utf8").trim());
    if (pid && pid !== process.pid && isProcessAlive(pid)) {
      throw new Error(
        `The embedded database at ${dir} is in use by another process (pid ${pid}).\n` +
          `Stop the dev server before running database scripts, or set DATABASE_URL to use PostgreSQL.\n` +
          `If no such process exists, delete ${lockFile}.`,
      );
    }
  }
  writeFileSync(lockFile, String(process.pid));
  const release = () => {
    try {
      if (existsSync(lockFile) && readFileSync(lockFile, "utf8").trim() === String(process.pid)) rmSync(lockFile);
    } catch {
      // best effort
    }
  };
  process.once("exit", release);
  return release;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

function create(): Instance {
  if (env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error", err));
    const db = drizzleNodePg(pool, { schema }) as unknown as DB;
    return { db, close: () => pool.end() };
  }

  const dir = embeddedDir();
  mkdirSync(path.dirname(dir), { recursive: true });
  const release = acquireEmbeddedLock(dir);
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  return {
    db,
    close: async () => {
      await client.close();
      release();
    },
  };
}

function instance(): Instance {
  return (globalStore.__cybergramDb ??= create());
}

export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = instance().db;
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export async function closeDb(): Promise<void> {
  const current = globalStore.__cybergramDb;
  if (!current) return;
  globalStore.__cybergramDb = undefined;
  await current.close();
}

export { schema };
