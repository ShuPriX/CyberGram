import "server-only";
import { asc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { newsItems, posts, profiles, users } from "@/db/schema";
import { invalidate, memo } from "@/lib/cache";
import { newId } from "@/lib/ids";
import { parseNewsFeed } from "@/lib/news/parse";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { safeFetchText } from "@/lib/security/safe-fetch";

const DAY = 24 * 60 * 60 * 1000;
/** How often the desk is refreshed. The home feed promises "every 30 minutes". */
export const NEWS_REFRESH_MS = 30 * 60 * 1000;
const KEEP_FOR_MS = 45 * DAY;
const ACCEPT_WITHIN_MS = 21 * DAY;

/**
 * News appears in the feed as ordinary posts from this platform-run account, so members can
 * like, comment on, repost and share a headline like anything else. The account has no
 * password and no linked sign-in: nobody can log in as it.
 */
export const NEWS_ACCOUNT = { username: "news-desk", name: "CyberGram News", email: "news-desk@system.cybergram.invalid" } as const;

const globalStore = globalThis as unknown as { __cybergramNewsSyncedAt?: number };

export type NewsSyncReport = { added: number; posted: number; sources: number; failed: string[] };

async function ensureNewsAccount(): Promise<string> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, NEWS_ACCOUNT.username)).limit(1);
  if (existing) return existing.id;
  const id = newId();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id, email: NEWS_ACCOUNT.email, username: NEWS_ACCOUNT.username, name: NEWS_ACCOUNT.name, passwordHash: null, emailVerifiedAt: now, onboardedAt: now });
    await tx.insert(profiles).values({
      userId: id,
      headline: "Security headlines from named agencies, research teams and security press",
      bio: `Run by the platform. Posts here are headlines and short summaries collected every 30 minutes from ${NEWS_SOURCES.length} established sources; each post names where it came from.`,
      visibility: "public",
      messagePolicy: "none",
    });
  });
  invalidate("news:");
  return id;
}

/** The news account's id, for filtering a feed down to news. Null until the first sync has run. */
export function getNewsAccountId(): Promise<string | null> {
  return memo("news:account", 10 * 60_000, async () => {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, NEWS_ACCOUNT.username)).limit(1);
    return row?.id ?? null;
  });
}

const DOMAIN_RULES: [RegExp, string][] = [
  [/\b(ai|llm|genai|chatgpt|prompt injection|machine learning|agentic)\b/i, "ai-security"],
  [/\b(ransomware|malware|stealer|infostealer|trojan|botnet|backdoor|rootkit|wiper|loader|rat)\b/i, "malware-analysis"],
  [/\b(supply[- ]chain|npm|pypi|github actions|ci\/cd|pipeline|dependency|package)\b/i, "devsecops"],
  [/\b(cloud|aws|azure|gcp|kubernetes|s3 bucket|container)\b/i, "cloud-security"],
  [/\b(cve-\d{4}-\d+|zero[- ]day|vulnerabilit\w+|patch\w*|exploit\w*|rce|privilege escalation)\b/i, "vapt"],
  [/\b(xss|sql injection|csrf|ssrf|oauth|api security|web app\w*|browser)\b/i, "application-security"],
  [/\b(apt\d*|threat actor|espionage|campaign|nation[- ]state|phishing|hacking group|cybercrime)\b/i, "threat-intelligence"],
  [/\b(forensic\w*|incident response|dfir)\b/i, "digital-forensics"],
  [/\b(fine[sd]?|regulat\w+|gdpr|compliance|lawsuit|privacy|data protection|policy|sanction\w*)\b/i, "grc"],
  [/\b(soc|siem|detection|edr|xdr|alert\w*)\b/i, "soc"],
  [/\b(bug bounty|hackerone|bugcrowd)\b/i, "bug-bounty"],
  [/\b(router|firewall|vpn|dns|ddos|network\w*)\b/i, "networking"],
];

export const domainOf = (text: string) => DOMAIN_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "general";

/** Publishes stored headlines that have not been posted yet as posts from the news account. */
async function publishPending(): Promise<number> {
  const pending = await db.select().from(newsItems).where(isNull(newsItems.postedAt)).orderBy(asc(newsItems.publishedAt)).limit(300);
  if (pending.length === 0) return 0;
  const authorId = await ensureNewsAccount();
  await db.transaction(async (tx) => {
    await tx.insert(posts).values(
      pending.map((item) => {
        const body = [item.excerpt, `Source: ${item.sourceName}`].filter(Boolean).join("\n\n");
        return {
          authorId,
          type: "post" as const,
          category: domainOf(`${item.title} ${item.excerpt ?? ""}`),
          title: item.title,
          body,
          excerpt: item.excerpt ?? item.title,
          visibility: "public" as const,
          // Dated when the publisher released it, so the feed stays in true chronological order.
          createdAt: item.publishedAt,
        };
      }),
    );
    await tx.update(newsItems).set({ postedAt: new Date() }).where(inArray(newsItems.id, pending.map((item) => item.id)));
  });
  invalidate("feed:");
  return pending.length;
}

/**
 * Reads every source's feed, stores headlines that are new and publishes them to the feed.
 * Sources are independent: one that is down or malformed is reported and skipped, and never
 * removes what is already stored.
 */
export async function syncNews(): Promise<NewsSyncReport> {
  const report: NewsSyncReport = { added: 0, posted: 0, sources: 0, failed: [] };
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

  report.posted = await publishPending();
  // The ledger of seen links is kept for a while so an old headline is never posted twice.
  await db.delete(newsItems).where(lt(newsItems.publishedAt, new Date(Date.now() - KEEP_FOR_MS)));
  globalStore.__cybergramNewsSyncedAt = Date.now();
  return report;
}

/** For the scheduler, which ticks more often than the desk needs refreshing. */
export async function syncNewsIfDue(): Promise<NewsSyncReport | null> {
  const last = globalStore.__cybergramNewsSyncedAt ?? 0;
  if (Date.now() - last < NEWS_REFRESH_MS - 60_000) return null;
  return syncNews();
}
