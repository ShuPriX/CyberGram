import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { memo } from "@/lib/cache";
import { CATEGORIES } from "@/lib/constants";

export type Category = { slug: string; name: string; description: string };

/** Content categories as managed by administrators (falls back to the built-in list). */
export function getActiveCategories(): Promise<Category[]> {
  return memo("taxonomy:categories", 60_000, async () => {
    const rows = await db
      .select({ slug: categories.slug, name: categories.name, description: categories.description })
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.position), asc(categories.name));
    return rows.length > 0 ? rows : CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, description: c.description }));
  });
}

export async function getCategory(slug: string): Promise<Category | null> {
  return (await getActiveCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getCategoryNames(): Promise<Record<string, string>> {
  return Object.fromEntries((await getActiveCategories()).map((c) => [c.slug, c.name]));
}

export async function isValidCategory(slug: string): Promise<boolean> {
  return (await getActiveCategories()).some((c) => c.slug === slug);
}
