import "server-only";
import { z } from "zod";

/**
 * Validated, typed server configuration.
 *
 * This module is server-only: importing it from client code is a build error, which keeps
 * secrets out of the browser bundle by construction.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());
const flag = (fallback: boolean) =>
  z.preprocess(blankToUndefined, z.string().optional()).transform((v) => (v === undefined ? fallback : v === "true" || v === "1"));
const int = (fallback: number) => z.preprocess(blankToUndefined, z.coerce.number().int().nonnegative().default(fallback));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.preprocess(blankToUndefined, z.url().default("http://localhost:3000")),
  APP_SECRET: optionalString,

  DATABASE_URL: optionalString,
  DATABASE_POOL_MAX: int(10),
  PGLITE_DIR: optionalString,
  AUTO_MIGRATE: flag(false),

  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  SMTP_URL: optionalString,
  EMAIL_FROM: z.preprocess(blankToUndefined, z.string().default("CyberGram <no-reply@localhost>")),

  REDIS_URL: optionalString,

  STORAGE_DRIVER: z.preprocess(blankToUndefined, z.enum(["local", "s3"]).default("local")),
  S3_ENDPOINT: optionalString,
  S3_REGION: z.preprocess(blankToUndefined, z.string().default("auto")),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,

  CLAMAV_HOST: optionalString,
  CLAMAV_PORT: int(3310),
  UPLOAD_REQUIRE_SCAN: flag(false),

  CRON_SECRET: optionalString,
  ENABLE_INTERNAL_SCHEDULER: flag(false),

  TRUSTED_PROXY_HOPS: int(1),
  HIBP_CHECK: flag(true),
  ALLOW_LOCAL_FEEDS: flag(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === "production";
// `next build` evaluates server modules without the runtime environment being present.
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const appUrl = raw.APP_URL.replace(/\/+$/, "");

if (isProd && !isBuild) {
  const problems: string[] = [];
  if (!raw.APP_SECRET || raw.APP_SECRET.length < 32) problems.push("APP_SECRET must be set to at least 32 random characters");
  const { protocol, hostname } = new URL(appUrl);
  if (protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
    problems.push("APP_URL must use https:// in production");
  }
  if (raw.STORAGE_DRIVER === "s3" && !(raw.S3_BUCKET && raw.S3_ACCESS_KEY_ID && raw.S3_SECRET_ACCESS_KEY && raw.S3_ENDPOINT)) {
    problems.push("STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY");
  }
  if (problems.length > 0) {
    throw new Error(`Refusing to start with an unsafe production configuration:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
  }
}

export const env = {
  ...raw,
  APP_URL: appUrl,
  /** Development falls back to a fixed value so the app runs out of the box; production must set it. */
  APP_SECRET: raw.APP_SECRET ?? "insecure-development-secret-do-not-use-in-production",
  isProd,
  isDev: raw.NODE_ENV === "development",
  /** True when no external Postgres is configured and the embedded PGlite database is used. */
  isEmbeddedDb: !raw.DATABASE_URL,
  /** Cookies are marked Secure (and use the __Host- prefix) whenever the app is served over TLS. */
  isSecureOrigin: appUrl.startsWith("https://"),
  oauth: {
    github: Boolean(raw.GITHUB_CLIENT_ID && raw.GITHUB_CLIENT_SECRET),
    google: Boolean(raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET),
  },
} as const;

export type Env = typeof env;
