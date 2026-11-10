/**
 * Pure text helpers shared by server and client.
 * User content is stored as plain text / Markdown and is always rendered through React
 * (which escapes it) — never as raw HTML.
 */

// Hashtags start with a letter so things like "#1" or hex colours are not treated as tags.
const HASHTAG_SOURCE = "(^|[^\\w&/#])#([A-Za-z][\\w]{1,49})";
// Handles: 3–30 chars of letters, digits, underscore or hyphen.
const MENTION_SOURCE = "(^|[^\\w@/.])@([A-Za-z0-9][A-Za-z0-9_-]{2,29})";
const URL_SOURCE = "\\bhttps?:\\/\\/[^\\s<>\"'`]+";

export const hashtagRegex = () => new RegExp(HASHTAG_SOURCE, "g");
export const mentionRegex = () => new RegExp(MENTION_SOURCE, "g");
export const urlRegex = () => new RegExp(URL_SOURCE, "gi");

/** Strips fenced and inline code so tags/mentions inside code samples are ignored. */
function withoutCode(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}

export function extractHashtags(text: string, max = 12): string[] {
  const found = new Set<string>();
  for (const match of withoutCode(text).matchAll(hashtagRegex())) {
    found.add(match[2]!.toLowerCase());
    if (found.size >= max) break;
  }
  return [...found];
}

export function extractMentions(text: string, max = 15): string[] {
  const found = new Set<string>();
  for (const match of withoutCode(text).matchAll(mentionRegex())) {
    found.add(match[2]!.toLowerCase());
    if (found.size >= max) break;
  }
  return [...found];
}

/** Trailing punctuation is almost always sentence punctuation, not part of the URL. */
export function trimUrl(url: string): string {
  const count = (s: string, ch: string) => s.split(ch).length - 1;
  let out = url.replace(/[.,;:!?]+$/, "");
  // Drop unbalanced closing brackets: "(see https://example.com/a)" → "https://example.com/a",
  // while keeping balanced ones such as ".../wiki/Salt_(cryptography)".
  while (
    (out.endsWith(")") && count(out, ")") > count(out, "(")) ||
    (out.endsWith("]") && count(out, "]") > count(out, "["))
  ) {
    out = out.slice(0, -1).replace(/[.,;:!?]+$/, "");
  }
  return out;
}

export function extractUrls(text: string, max = 20): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(urlRegex())) {
    found.add(trimUrl(match[0]));
    if (found.size >= max) break;
  }
  return [...found];
}

// C0/C1 control characters (except tab and newline), zero-width characters, and the
// bidirectional override/isolate characters used for display spoofing ("Trojan Source").
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Normalises multi-line user text: consistent newlines, no invisible/spoofing characters. */
export function cleanText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(UNSAFE_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/** Normalises single-line user text (names, titles, headlines). */
export function cleanInline(input: string): string {
  return input.replace(UNSAFE_CHARS, "").replace(/\s+/g, " ").trim();
}

/** Plain-text preview of Markdown content for cards, metadata and notifications. */
export function excerptOf(markdown: string, max = 200): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export type TextToken =
  | { kind: "text"; value: string }
  | { kind: "url"; value: string }
  | { kind: "hashtag"; value: string }
  | { kind: "mention"; value: string }
  | { kind: "code"; value: string }
  | { kind: "codeblock"; value: string; lang: string | null };

const INLINE_TOKEN = new RegExp(`(\`[^\`\\n]+\`)|(${URL_SOURCE})|${HASHTAG_SOURCE}|${MENTION_SOURCE}`, "gi");

function tokenizeInline(text: string, out: TextToken[]) {
  let cursor = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const last = out.at(-1);
    if (last?.kind === "text") last.value += value;
    else out.push({ kind: "text", value });
  };
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const index = m.index;
    pushText(text.slice(cursor, index));
    if (m[1]) {
      out.push({ kind: "code", value: m[1].slice(1, -1) });
    } else if (m[2]) {
      const url = trimUrl(m[2]);
      out.push({ kind: "url", value: url });
      pushText(m[2].slice(url.length));
    } else if (m[4]) {
      pushText(m[3] ?? "");
      out.push({ kind: "hashtag", value: m[4] });
    } else if (m[6]) {
      pushText(m[5] ?? "");
      out.push({ kind: "mention", value: m[6] });
    }
    cursor = index + m[0].length;
  }
  pushText(text.slice(cursor));
}

/** Splits post text into renderable tokens: code blocks, inline code, links, tags, mentions. */
export function tokenize(text: string): TextToken[] {
  const out: TextToken[] = [];
  const fence = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  for (const m of text.matchAll(fence)) {
    tokenizeInline(text.slice(cursor, m.index), out);
    out.push({ kind: "codeblock", lang: m[1] || null, value: (m[2] ?? "").replace(/\n$/, "") });
    cursor = m.index + m[0].length;
  }
  tokenizeInline(text.slice(cursor), out);
  return out;
}
