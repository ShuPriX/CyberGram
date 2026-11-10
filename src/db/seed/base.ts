import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { categories, communities, resources, roadmaps } from "@/db/schema";
import { CATEGORIES } from "@/lib/constants";
import { SEED_COMMUNITIES, SEED_RESOURCES, SEED_ROADMAPS } from "./content";

/**
 * Idempotently installs the platform's reference data: content categories, the official
 * communities, learning roadmaps and curated resources. Existing rows are never overwritten,
 * so administrator edits survive re-runs.
 */
export async function seedBase(): Promise<void> {
  await db
    .insert(categories)
    .values(CATEGORIES.map((c, index) => ({ slug: c.slug, name: c.name, description: c.description, position: index })))
    .onConflictDoNothing();

  await db
    .insert(communities)
    .values(SEED_COMMUNITIES.map((c) => ({ ...c, isOfficial: true })))
    .onConflictDoNothing({ target: communities.slug });

  await db
    .insert(roadmaps)
    .values(SEED_ROADMAPS.map((r, index) => ({ ...r, position: index })))
    .onConflictDoNothing({ target: roadmaps.slug });

  await db
    .insert(resources)
    .values(SEED_RESOURCES.map((r) => ({ ...r, isFree: true, isCurated: true, status: "approved" as const })))
    .onConflictDoNothing({ target: resources.url });
}

/** True on a brand-new database, before the reference data has been installed. */
export async function needsBaseSeed(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(categories);
  return (row?.value ?? 0) === 0;
}
