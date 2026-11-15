import { decodeEntities } from "../jobs/classify";
import { parseHttpUrl } from "../security/link-safety";
import { cleanInline } from "../text";
import type { NewsSource } from "./sources";

export type ParsedNewsItem = { title: string; url: string; excerpt: string | null; publishedAt: Date };

const EXCERPT_LENGTH = 260;
const MAX_ITEMS_PER_FEED = 40;

const unwrap = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

/** Feed text → plain text. Markup is removed outright; nothing from a feed is ever rendered as HTML. */
function plain(value: string): string {
  const withoutTags = unwrap(value)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  // Entities may be double-encoded inside CDATA-less descriptions, so strip tags once more afterwards.
  return cleanInline(decodeEntities(withoutTags).replace(/<[^>]+>/g, " "));
}

function tag(block: string, names: string[]): string | null {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
    if (match?.[1]?.trim()) return match[1];
  }
  return null;
}

function linkOf(block: string): string | null {
  // Atom: <link rel="alternate" href="…"/> (rel may be absent). RSS: <link>…</link>.
  const atom = [...block.matchAll(/<link\b([^>]*)\/?>/gi)]
    .map((m) => m[1] ?? "")
    .filter((attrs) => /href=/i.test(attrs) && !/rel=["'](?!alternate)/i.test(attrs))
    .map((attrs) => attrs.match(/href=["']([^"']+)["']/i)?.[1])
    .find(Boolean);
  if (atom) return decodeEntities(atom);
  const rss = tag(block, ["link"]);
  return rss ? decodeEntities(unwrap(rss).trim()) : null;
}

function truncate(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), EXCERPT_LENGTH - 40)).trimEnd()}…`;
}

const onSourceHost = (host: string, source: NewsSource) => source.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));

/**
 * Parses an RSS 2.0 or Atom document into headline records. Deliberately strict: an item is
 * dropped unless it has a title, a date and an https link on one of the source's own hosts.
 */
export function parseNewsFeed(xml: string, source: NewsSource): ParsedNewsItem[] {
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
  const items: ParsedNewsItem[] = [];
  const now = Date.now();

  for (const block of blocks.slice(0, MAX_ITEMS_PER_FEED)) {
    const title = plain(tag(block, ["title"]) ?? "").slice(0, 300);
    const url = parseHttpUrl(linkOf(block) ?? "");
    const dateText = tag(block, ["pubDate", "published", "updated", "dc:date"]);
    const publishedAt = dateText ? new Date(unwrap(dateText).trim()) : null;
    if (!title || !url || !publishedAt || Number.isNaN(publishedAt.getTime())) continue;
    if (!onSourceHost(url.hostname.toLowerCase(), source)) continue;
    // Some long-running feeds still print http:// links to their own (HTTPS) site.
    url.protocol = "https:";
    // Feeds occasionally carry future-dated or ancient entries; neither belongs in a news stream.
    if (publishedAt.getTime() > now + 60 * 60 * 1000) continue;

    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);

    const summary = plain(tag(block, ["description", "summary", "content:encoded", "content"]) ?? "");
    items.push({ title, url: url.toString(), excerpt: summary && summary !== title ? truncate(summary) : null, publishedAt });
  }
  return items;
}
