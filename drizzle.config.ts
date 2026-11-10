import { defineConfig } from "drizzle-kit";

/**
 * Used by `drizzle-kit generate` to diff the schema into SQL migrations (./drizzle).
 * Migrations are applied by `npm run db:migrate` (or automatically on boot in embedded mode),
 * so this config intentionally needs no live database connection.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
