import { sql } from "drizzle-orm";
import { text, timestamp } from "drizzle-orm/pg-core";
// Relative imports only: drizzle-kit loads schema files without tsconfig path aliases.
import { newId } from "../../lib/ids";

export const pk = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => newId());

export const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const createdAt = () => tstz("created_at").notNull().defaultNow();

export const updatedAt = () =>
  tstz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'::text[]`);
