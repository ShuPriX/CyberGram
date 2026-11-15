import "server-only";
import { lt } from "drizzle-orm";
import { db } from "@/db";
import { newsItems } from "@/db/schema";
import { invalidate } from "@/lib/cache";
import { parseNewsFeed } from "@/lib/news/parse";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { safeFetchText } from "@/lib/security/safe-fetch";

const DAY = 24 * 60 * 60 * 1000;
/** How often the desk is refreshed. The home feed promises "every 30 minutes". */
export const NEWS_REFRESH_MS = 30 * 60 * 1000;
const KEEP_FOR_MS = 45 * DAY;
const ACCEPT_WITHIN_MS = 21 * DAY;

const globalStore = globalThis as unknown as { __cybergramNewsSyncedAt?: number };

export type NewsSyncReport = { added: number; sources: number; failed: string[] };

/**
 * Reads every source's feed and stores headlines that are new. Sources are independent: one
 * that is down or malformed is reported and skipped, and never removes what is already stored.
 */
export async function syncNews(): Promise<NewsSyncReport> {
  const report: NewsSyncReport = { added: 0, sources: 0, failed: [] };
  const cutoff = Date.now() - ACCEPT_WITHIN_MS;

  const results = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      const xml = await safeFetchText(source.feed, {
        maxBytes: 6 * 1024 * 1024,
        timeoutMs: 20_000,
        accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
      });
      return { source, items: parseNewsFeed(xml, source).filter((item) => item.publishedAt.getTime() >= cutoff) };
    }),
  );

  for (const [index, result] of results.entries()) {
    const source = NEWS_SOURCES[index]!;
    if (result.status === "rejected") {
      report.failed.push(`${source.name}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      continue;
    }
    report.sources++;
    if (result.value.items.length === 0) continue;
    const inserted = await db
      .insert(newsItems)
      .values(result.value.items.map((item) => ({ ...item, source: source.key, sourceName: source.name, sourceKind: source.kind })))
      .onConflictDoNothing({ target: newsItems.url })
      .returning({ id: newsItems.id });
    report.added += inserted.length;
  }

  await db.delete(newsItems).where(lt(newsItems.publishedAt, new Date(Date.now() - KEEP_FOR_MS)));
  globalStore.__cybergramNewsSyncedAt = Date.now();
  if (report.added > 0) invalidate("news:");
  return report;
}

/** For the scheduler, which ticks more often than the desk needs refreshing. */
export async function syncNewsIfDue(): Promise<NewsSyncReport | null> {
  const last = globalStore.__cybergramNewsSyncedAt ?? 0;
  if (Date.now() - last < NEWS_REFRESH_MS - 60_000) return null;
  return syncNews();
}
