import type { Metadata } from "next";
import { APP_NAME } from "./constants";

/** Public origin, without a trailing slash. Safe to use in server components and metadata. */
export const SITE_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageMeta = {
  title: string;
  description: string;
  /** Canonical path. Filter/sort variations must point at their clean landing URL. */
  path: string;
  noindex?: boolean;
  type?: "website" | "article" | "profile";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

/** Consistent title, description, canonical, Open Graph and Twitter metadata for a page. */
export function pageMetadata(meta: PageMeta): Metadata {
  const description = meta.description.length > 300 ? `${meta.description.slice(0, 297).trimEnd()}…` : meta.description;
  return {
    title: meta.title,
    description,
    alternates: { canonical: meta.path },
    robots: meta.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: meta.title,
      description,
      url: meta.path,
      siteName: APP_NAME,
      locale: "en_US",
      type: meta.type ?? "website",
      ...(meta.type === "article"
        ? { publishedTime: meta.publishedTime, modifiedTime: meta.modifiedTime, authors: meta.authors }
        : {}),
    },
    twitter: { card: "summary_large_image", title: meta.title, description },
  };
}

/** Private, per-member screens: never indexed, no canonical. */
export function privateMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

// ── Structured data (Schema.org JSON-LD) ─────────────────────────────────────

export type JsonLdObject = Record<string, unknown>;

export function breadcrumbLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function websiteLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function platformOrganizationLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    description: "A professional network and career platform built exclusively for the cybersecurity community.",
  };
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Minimal Markdown → HTML for the JobPosting `description` field, which search engines expect
 * as HTML. Everything is escaped first; only paragraph, list and heading structure is emitted.
 */
export function markdownToBasicHtml(markdown: string): string {
  const out: string[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "$1");
  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.join("<br>")}</p>`);
    paragraph = [];
  };
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^(?:[-*+]|\d+\.)\s+(.*)$/);
    if (heading) {
      flushList();
      flushParagraph();
      out.push(`<h3>${inline(heading[1]!)}</h3>`);
    } else if (bullet) {
      flushParagraph();
      list.push(inline(bullet[1]!));
    } else {
      flushList();
      paragraph.push(inline(line));
    }
  }
  flushList();
  flushParagraph();
  return out.join("");
}
