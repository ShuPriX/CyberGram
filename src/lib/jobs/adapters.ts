import "server-only";
import type { JobSourceKind } from "@/lib/constants";
import { safeFetchJson, safeFetchText } from "@/lib/security/safe-fetch";
import { decodeEntities, htmlToMarkdown } from "./classify";

/** A listing as published by its source, before classification. */
export type SourceJob = {
  externalId: string;
  title: string;
  /** Markdown. */
  description: string;
  location: string | null;
  url: string;
  postedAt: Date | null;
  department?: string | null;
  employmentHint?: string | null;
  arrangementHint?: string | null;
  salary?: { min: number | null; max: number | null; currency: string | null; period: "year" | "month" | "hour" | null } | null;
  /** Feeds that aggregate several employers may name the company per listing. */
  companyName?: string | null;
};

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
function assertToken(value: string, label: string): string {
  if (!TOKEN.test(value)) throw new Error(`Invalid ${label}: only letters, digits, dots, dashes and underscores are allowed.`);
  return value;
}

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

// ── Greenhouse Job Board API ────────────────────────────────────────────────
type GreenhouseJob = {
  id: number;
  title: string;
  content?: string;
  absolute_url: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
};

async function fetchGreenhouse(target: string): Promise<SourceJob[]> {
  const data = await safeFetchJson<{ jobs?: GreenhouseJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${assertToken(target, "board token")}/jobs?content=true`,
  );
  if (!Array.isArray(data.jobs)) throw new Error("Unexpected Greenhouse response.");
  return data.jobs.map((job) => ({
    externalId: String(job.id),
    title: text(job.title),
    description: htmlToMarkdown(job.content ?? ""),
    location: text(job.location?.name) || null,
    url: job.absolute_url,
    postedAt: toDate(job.first_published) ?? toDate(job.updated_at),
    department: job.departments?.map((d) => d.name).filter(Boolean).join(", ") || null,
  }));
}

// ── Lever Postings API ───────────────────────────────────────────────────────
type LeverPosting = {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  additionalPlain?: string;
  lists?: { text?: string; content?: string }[];
  workplaceType?: string;
  categories?: { commitment?: string; department?: string; team?: string; location?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

async function fetchLever(target: string): Promise<SourceJob[]> {
  const data = await safeFetchJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${assertToken(target, "site name")}?mode=json`);
  if (!Array.isArray(data)) throw new Error("Unexpected Lever response.");
  return data.map((posting) => {
    const sections = (posting.lists ?? [])
      .map((list) => `### ${text(list.text)}\n\n${htmlToMarkdown(list.content ?? "")}`)
      .join("\n\n");
    const body = [posting.description ? htmlToMarkdown(posting.description) : text(posting.descriptionPlain), sections, text(posting.additionalPlain)]
      .filter(Boolean)
      .join("\n\n");
    const interval = posting.salaryRange?.interval ?? "";
    return {
      externalId: posting.id,
      title: text(posting.text),
      description: body,
      location: text(posting.categories?.location) || null,
      url: posting.hostedUrl,
      postedAt: toDate(posting.createdAt),
      department: [posting.categories?.department, posting.categories?.team].filter(Boolean).join(", ") || null,
      employmentHint: posting.categories?.commitment ?? null,
      arrangementHint: posting.workplaceType ?? null,
      salary: posting.salaryRange
        ? {
            min: posting.salaryRange.min ?? null,
            max: posting.salaryRange.max ?? null,
            currency: posting.salaryRange.currency ?? null,
            period: /hour/i.test(interval) ? "hour" : /month/i.test(interval) ? "month" : "year",
          }
        : null,
    };
  });
}

// ── Ashby Job Postings API ───────────────────────────────────────────────────
type AshbyJob = {
  id: string;
  title: string;
  jobUrl: string;
  isListed?: boolean;
  publishedAt?: string;
  location?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  isRemote?: boolean;
  workplaceType?: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
};

async function fetchAshby(target: string): Promise<SourceJob[]> {
  const data = await safeFetchJson<{ jobs?: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${assertToken(target, "job board name")}?includeCompensation=false`,
  );
  if (!Array.isArray(data.jobs)) throw new Error("Unexpected Ashby response.");
  return data.jobs
    .filter((job) => job.isListed !== false)
    .map((job) => ({
      externalId: job.id,
      title: text(job.title),
      description: job.descriptionHtml ? htmlToMarkdown(job.descriptionHtml) : text(job.descriptionPlain),
      location: text(job.location) || null,
      url: job.jobUrl,
      postedAt: toDate(job.publishedAt),
      department: [job.department, job.team].filter(Boolean).join(", ") || null,
      employmentHint: job.employmentType ?? null,
      arrangementHint: job.workplaceType ?? (job.isRemote ? "remote" : null),
    }));
}

// ── CyberGram JSON feed ──────────────────────────────────────────────────────
/**
 * The documented partner format: `{ "jobs": [ { id, title, description, url, location?,
 * company?, postedAt?, employmentType?, workArrangement?, salaryMin?, salaryMax?,
 * salaryCurrency?, salaryPeriod? } ] }` (a bare array is accepted too).
 */
async function fetchJsonFeed(target: string): Promise<SourceJob[]> {
  const data = await safeFetchJson<unknown>(target);
  const list = Array.isArray(data) ? data : (data as { jobs?: unknown[] })?.jobs;
  if (!Array.isArray(list)) throw new Error('The feed must be a JSON array or an object with a "jobs" array.');
  return list.slice(0, 5000).map((raw) => {
    const item = raw as Record<string, unknown>;
    const description = text(item.description);
    const period = text(item.salaryPeriod);
    return {
      externalId: text(item.id) || String(item.id ?? "") || text(item.url),
      title: text(item.title),
      description: /<\w+[^>]*>/.test(description) ? htmlToMarkdown(description) : description,
      location: text(item.location) || null,
      url: text(item.url),
      postedAt: toDate(item.postedAt),
      companyName: text(item.company) || null,
      employmentHint: text(item.employmentType) || null,
      arrangementHint: text(item.workArrangement) || null,
      salary:
        typeof item.salaryMin === "number" || typeof item.salaryMax === "number"
          ? {
              min: typeof item.salaryMin === "number" ? item.salaryMin : null,
              max: typeof item.salaryMax === "number" ? item.salaryMax : null,
              currency: text(item.salaryCurrency) || null,
              period: period === "month" || period === "hour" ? period : "year",
            }
          : null,
    };
  });
}

// ── RSS 2.0 / Atom ───────────────────────────────────────────────────────────
function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!match) return "";
  return match[1]!.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim();
}

async function fetchRss(target: string): Promise<SourceJob[]> {
  const xml = await safeFetchText(target, { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" });
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  if (blocks.length === 0 && !/<(rss|feed)\b/i.test(xml)) throw new Error("The URL did not return an RSS or Atom feed.");
  return blocks.slice(0, 2000).map((block) => {
    const link = tag(block, "link") || block.match(/<link\b[^>]*\bhref="([^"]+)"/i)?.[1] || "";
    const body = tag(block, "content:encoded") || tag(block, "description") || tag(block, "content") || tag(block, "summary");
    return {
      externalId: tag(block, "guid") || tag(block, "id") || link,
      title: decodeEntities(tag(block, "title").replace(/<[^>]+>/g, "")),
      description: htmlToMarkdown(body),
      location: decodeEntities(tag(block, "location") || tag(block, "job:location")) || null,
      url: decodeEntities(link),
      postedAt: toDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated")),
    };
  });
}

const ADAPTERS: Record<JobSourceKind, (target: string) => Promise<SourceJob[]>> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  json_feed: fetchJsonFeed,
  rss: fetchRss,
};

export const SOURCE_KIND_LABELS: Record<JobSourceKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  json_feed: "JSON feed",
  rss: "RSS feed",
};

/** Fetches every listing currently published by a source. Throws on any transport/format error. */
export function fetchSourceJobs(kind: JobSourceKind, target: string): Promise<SourceJob[]> {
  return ADAPTERS[kind](target);
}
