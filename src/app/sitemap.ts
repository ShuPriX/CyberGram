import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/db";
import { communities, companies, jobs, posts, profiles, roadmaps, users } from "@/db/schema";
import { memo } from "@/lib/cache";
import { JOB_LANDINGS } from "@/lib/job-landings";
import { absoluteUrl } from "@/lib/seo";
import { listJobs, openJobCondition } from "@/server/queries/jobs";
import { getActiveCategories } from "@/server/queries/taxonomy";

// Built on request so it always reflects which roles are open right now.
export const dynamic = "force-dynamic";

const LIMIT = 5000;

/**
 * Only canonical, indexable pages are listed: open jobs (never closed ones), public indexable
 * profiles, published articles, active organisations, and landing pages that currently have
 * roles. Demo data is excluded.
 */
export default function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Cached in memory: an unauthenticated URL must not be a way to run dozens of queries per request.
  return memo("seo:sitemap", 10 * 60_000, buildSitemap);
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, jobRows, companyRows, articleRows, profileRows, communityRows, roadmapRows, landings] = await Promise.all([
    getActiveCategories(),
    db.select({ slug: jobs.slug, updatedAt: jobs.lastVerifiedAt }).from(jobs).where(and(openJobCondition(), eq(jobs.isDemo, false))).orderBy(desc(jobs.postedAt)).limit(LIMIT),
    db.select({ slug: companies.slug, updatedAt: companies.updatedAt }).from(companies).where(and(eq(companies.status, "active"), eq(companies.isDemo, false))).limit(LIMIT),
    db
      .select({ slug: posts.slug, updatedAt: sql<Date>`coalesce(${posts.editedAt}, ${posts.createdAt})`.mapWith(posts.createdAt) })
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(isNotNull(posts.slug), eq(posts.status, "published"), eq(posts.visibility, "public"), eq(users.status, "active"), eq(users.isDemo, false)))
      .orderBy(desc(posts.createdAt))
      .limit(LIMIT),
    db
      .select({ username: users.username, updatedAt: profiles.updatedAt })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(and(eq(users.status, "active"), eq(users.isDemo, false), isNotNull(users.onboardedAt), eq(profiles.visibility, "public"), eq(profiles.indexable, true)))
      .orderBy(desc(profiles.updatedAt))
      .limit(LIMIT),
    db.select({ slug: communities.slug }).from(communities),
    db.select({ slug: roadmaps.slug, updatedAt: roadmaps.updatedAt }).from(roadmaps),
    Promise.all(JOB_LANDINGS.map(async (landing) => ({ landing, total: (await listJobs({ ...landing.filters, pageSize: 1 })).total }))),
  ]);

  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/jobs"), lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: absoluteUrl("/companies"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/explore"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/articles"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/communities"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/learn"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/learn/resources"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/events"), lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...fixed,
    ...landings.filter((l) => l.total > 0).map(({ landing }) => ({ url: absoluteUrl(`/cybersecurity-jobs/${landing.slug}`), lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: absoluteUrl(`/explore/${c.slug}`), changeFrequency: "daily" as const, priority: 0.5 })),
    ...jobRows.map((j) => ({ url: absoluteUrl(`/jobs/${j.slug}`), lastModified: j.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...companyRows.map((c) => ({ url: absoluteUrl(`/companies/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...articleRows.map((a) => ({ url: absoluteUrl(`/articles/${a.slug}`), lastModified: a.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...communityRows.map((c) => ({ url: absoluteUrl(`/communities/${c.slug}`), changeFrequency: "daily" as const, priority: 0.5 })),
    ...roadmapRows.map((r) => ({ url: absoluteUrl(`/learn/roadmaps/${r.slug}`), lastModified: r.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...profileRows.map((p) => ({ url: absoluteUrl(`/u/${p.username}`), lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
