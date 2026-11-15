import "server-only";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { newsItems, type NewsSourceKind } from "@/db/schema";
import { memo } from "@/lib/cache";

export type NewsItem = typeof newsItems.$inferSelect;

export type NewsQuery = { limit?: number; before?: Date; kind?: NewsSourceKind };

/** Latest headlines, newest first. Public and identical for everyone, so the first page is cached briefly. */
export function listNews(query: NewsQuery = {}): Promise<NewsItem[]> {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 60);
  const load = () => {
    const where: SQL[] = [];
    if (query.kind) where.push(eq(newsItems.sourceKind, query.kind));
    if (query.before) where.push(lt(newsItems.publishedAt, query.before));
    return db.select().from(newsItems).where(and(...where)).orderBy(desc(newsItems.publishedAt), desc(newsItems.id)).limit(limit);
  };
  return query.before ? load() : memo(`news:list:${query.kind ?? "all"}:${limit}`, 60_000, load);
}
