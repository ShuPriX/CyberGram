import * as nextEnv from "@next/env";

// Load .env, .env.local, etc. exactly the way Next.js does, before any app module reads them.
// Import this file first in every script.
const loadEnvConfig =
  nextEnv.loadEnvConfig ?? (nextEnv as unknown as { default: typeof nextEnv }).default.loadEnvConfig;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
