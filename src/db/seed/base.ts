import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/db";
import { categories, communities, jobSources, resources, roadmaps } from "@/db/schema";
import { CATEGORIES } from "@/lib/constants";
import { SEED_COMMUNITIES, SEED_RESOURCES, SEED_ROADMAPS } from "./content";
import { DEFAULT_JOB_SOURCES, DEFAULT_SOURCE_AUTHORIZATION_NOTE } from "./sources";

/**
 * Idempotently installs the platform's reference data: content categories, the official
 * communities, learning roadmaps, curated resources and the default job sources. Existing rows are never overwritten,
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

  // Employer job boards the hub follows by default. Staggered so the first run does not
  // request every board at the same moment.
  const now = Date.now();
  await db
    .insert(jobSources)
    .values(
      DEFAULT_JOB_SOURCES.map(([kind, target, companyName], index) => ({
        name: `${companyName} careers`,
        kind,
        target,
        companyName,
        authorizationBasis: "public_api_terms" as const,
        authorizationNote: DEFAULT_SOURCE_AUTHORIZATION_NOTE,
        enabled: true,
        // Listings from these boards go live directly; anything matching a scam pattern is still held.
        autoPublish: true,
        securityOnly: true,
        intervalHours: 12,
        nextSyncAt: new Date(now + index * 2000),
      })),
    )
    .onConflictDoNothing({ target: [jobSources.kind, jobSources.target] });
}

/** True on a brand-new database, before the reference data has been installed. */
export async function needsBaseSeed(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(categories);
  return (row?.value ?? 0) === 0;
}
