import "server-only";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { newsItems, outboundPosts, type CardPayload } from "@/db/schema";
import { env } from "@/lib/env";
import { listJobs } from "@/server/queries/jobs";
import { InstagramError, publishImage } from "./instagram";
import { domainOf } from "./news-sync";

const HOUR = 60 * 60 * 1000;
const CHANNEL = "instagram" as const;
/** A post that has been "pending" this long was interrupted; it is recorded as failed, never retried. */
const STALE_PENDING_MS = 20 * 60 * 1000;
/** After three failures in a row the poster rests, so a bad token does not burn through the news queue. */
const PAUSE_AFTER_FAILURES = 3;
const PAUSE_MS = 6 * HOUR;

const KIND_RANK = { official: 3, research: 2, press: 1 } as const;

const DOMAIN_LABELS: Record<string, { label: string; tags: string[] }> = {
  "ai-security": { label: "AI security", tags: ["AISecurity", "LLMSecurity"] },
  "malware-analysis": { label: "Malware", tags: ["Malware", "Ransomware", "ThreatResearch"] },
  devsecops: { label: "Supply chain", tags: ["DevSecOps", "SupplyChainSecurity"] },
  "cloud-security": { label: "Cloud security", tags: ["CloudSecurity"] },
  vapt: { label: "Vulnerabilities", tags: ["VAPT", "Vulnerability", "ZeroDay", "PenTesting"] },
  "application-security": { label: "AppSec", tags: ["AppSec", "WebSecurity"] },
  "threat-intelligence": { label: "Threat intel", tags: ["ThreatIntelligence", "APT", "CTI"] },
  "digital-forensics": { label: "DFIR", tags: ["DFIR", "IncidentResponse", "Forensics"] },
  grc: { label: "GRC & privacy", tags: ["GRC", "Compliance", "DataPrivacy"] },
  soc: { label: "SOC", tags: ["SOC", "BlueTeam", "ThreatDetection"] },
  "bug-bounty": { label: "Bug bounty", tags: ["BugBounty", "BugBountyTips"] },
  networking: { label: "Network security", tags: ["NetworkSecurity"] },
  general: { label: "Cyber news", tags: ["CyberNews"] },
};

const BASE_TAGS = ["cybersecurity", "infosec", "cybersecuritynews"];

export type SocialRunReport =
  | { status: "skipped"; reason: string }
  | { status: "dry-run"; key: string; caption: string; payload: CardPayload }
  | { status: "published"; key: string; externalId: string }
  | { status: "failed"; key: string; error: string };

const trimTo = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`);

function newsCaption(title: string, excerpt: string | null, source: string, domain: string): string {
  const tags = [...BASE_TAGS, ...(DOMAIN_LABELS[domain] ?? DOMAIN_LABELS.general!).tags].map((t) => `#${t}`).join(" ");
  return [
    title,
    excerpt && excerpt !== title ? trimTo(excerpt, 280) : null,
    `Source: ${source}`,
    "Security news, community and open roles — CyberGram. Link in bio.",
    tags,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function jobsCaption(total: number, roles: { title: string; company: string }[]): string {
  const lines = roles.map((r) => `▸ ${r.title} — ${r.company}`).join("\n");
  return [
    `${total.toLocaleString("en-US")} open cybersecurity roles right now.`,
    lines,
    "VAPT, SOC, analyst, GRC, cloud and more, collected from company career pages and updated through the day. Full list on CyberGram — link in bio.",
    [...BASE_TAGS, "cybersecurityjobs", "infosecjobs", "hiring", "socanalyst", "pentester"].map((t) => `#${t}`).join(" "),
  ].join("\n\n");
}

/** Job feeds sometimes carry placeholders such as "na"; those are not places. */
const cleanPlace = (value: string | null) => (value && value.trim().length > 2 ? value.trim() : "");

type Candidate = { key: string; payload: CardPayload; caption: string };

async function pickJobsDigest(now: Date): Promise<Candidate | null> {
  if (now.getUTCHours() < env.INSTAGRAM_JOBS_HOUR_UTC) return null;
  const key = `jobs:${now.toISOString().slice(0, 10)}`;
  const [taken] = await db.select({ id: outboundPosts.id }).from(outboundPosts).where(and(eq(outboundPosts.channel, CHANNEL), eq(outboundPosts.key, key))).limit(1);
  if (taken) return null;

  const { items, total } = await listJobs({ pageSize: 5, prioritizeEarlyCareer: true });
  if (items.length < 3) return null;
  const roles = items.map((job) => ({
    title: job.title,
    company: job.companyName,
    place: job.workArrangement === "remote" ? "Remote" : cleanPlace(job.location ?? job.country),
  }));
  return { key, payload: { kind: "jobs", total, roles }, caption: jobsCaption(total, roles) };
}

async function pickNews(now: Date): Promise<Candidate | null> {
  const done = new Set(
    (await db.select({ key: outboundPosts.key }).from(outboundPosts).where(eq(outboundPosts.channel, CHANNEL)).orderBy(desc(outboundPosts.createdAt)).limit(1000)).map((r) => r.key),
  );
  for (const windowHours of [24, 48]) {
    const rows = (
      await db
        .select()
        .from(newsItems)
        .where(gte(newsItems.publishedAt, new Date(now.getTime() - windowHours * HOUR)))
        .orderBy(desc(newsItems.publishedAt))
        .limit(150)
    ).filter((row) => !done.has(`news:${row.id}`));
    // Agency and research write-ups first, then the press; newest first within each tier.
    const best = rows.sort((a, b) => KIND_RANK[b.sourceKind] - KIND_RANK[a.sourceKind] || b.publishedAt.getTime() - a.publishedAt.getTime())[0];
    if (!best) continue;
    const domain = domainOf(`${best.title} ${best.excerpt ?? ""}`);
    return {
      key: `news:${best.id}`,
      payload: { kind: "news", title: best.title, source: best.sourceName, sourceKind: best.sourceKind, domain },
      caption: newsCaption(best.title, best.excerpt, best.sourceName, domain),
    };
  }
  return null;
}

/** Public, https address of the card image — Instagram fetches it from its own servers. */
function cardUrl(id: string): string | null {
  const url = new URL(`/api/social/card/${id}`, env.APP_URL);
  const host = url.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost") || host.endsWith(".test");
  return url.protocol === "https:" && !isLocal ? url.toString() : null;
}

/** Decides whether a post is due now: the daily pace, and a rest after repeated failures. */
async function dueReason(now: Date): Promise<string | null> {
  const recent = await db.select({ status: outboundPosts.status, at: outboundPosts.createdAt }).from(outboundPosts).where(eq(outboundPosts.channel, CHANNEL)).orderBy(desc(outboundPosts.createdAt)).limit(PAUSE_AFTER_FAILURES);
  if (recent.length === PAUSE_AFTER_FAILURES && recent.every((r) => r.status === "failed") && now.getTime() - recent[0]!.at.getTime() < PAUSE_MS) {
    return "paused after repeated failures; check the Instagram token and permissions";
  }
  const [last] = await db.select({ at: outboundPosts.createdAt }).from(outboundPosts).where(and(eq(outboundPosts.channel, CHANNEL), inArray(outboundPosts.status, ["published", "pending"]))).orderBy(desc(outboundPosts.createdAt)).limit(1);
  const gap = (24 * HOUR) / env.INSTAGRAM_POSTS_PER_DAY - 5 * 60_000;
  if (last && now.getTime() - last.at.getTime() < gap) return "not due yet";
  return null;
}

/**
 * Publishes the next card to Instagram when one is due: the daily jobs digest once the
 * configured hour has passed, otherwise the best unposted headline of the last day or two.
 * Idempotent and safe to call as often as you like.
 */
export async function runInstagramPosting(options: { dryRun?: boolean; force?: boolean } = {}): Promise<SocialRunReport> {
  if (!env.instagram && !options.dryRun) return { status: "skipped", reason: "Instagram is not connected" };
  const now = new Date();

  await db
    .update(outboundPosts)
    .set({ status: "failed", error: "Interrupted before it finished." })
    .where(and(eq(outboundPosts.channel, CHANNEL), eq(outboundPosts.status, "pending"), lt(outboundPosts.createdAt, new Date(now.getTime() - STALE_PENDING_MS))));

  if (!options.force && !options.dryRun) {
    const reason = await dueReason(now);
    if (reason) return { status: "skipped", reason };
  }

  const candidate = (await pickJobsDigest(now)) ?? (await pickNews(now));
  if (!candidate) return { status: "skipped", reason: "nothing new to post" };
  if (options.dryRun) return { status: "dry-run", key: candidate.key, caption: candidate.caption, payload: candidate.payload };

  const [claimed] = await db
    .insert(outboundPosts)
    .values({ channel: CHANNEL, key: candidate.key, payload: candidate.payload, caption: candidate.caption })
    .onConflictDoNothing()
    .returning({ id: outboundPosts.id });
  if (!claimed) return { status: "skipped", reason: "already claimed by another run" };

  try {
    const image = cardUrl(claimed.id);
    if (!image) throw new InstagramError("APP_URL must be a public https address so Instagram can fetch the card image.");
    const externalId = await publishImage(image, candidate.caption);
    await db.update(outboundPosts).set({ status: "published", externalId, publishedAt: new Date(), error: null }).where(eq(outboundPosts.id, claimed.id));
    return { status: "published", key: candidate.key, externalId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(outboundPosts).set({ status: "failed", error: message.slice(0, 500) }).where(eq(outboundPosts.id, claimed.id));
    console.error("[instagram] post failed:", message);
    return { status: "failed", key: candidate.key, error: message };
  }
}
