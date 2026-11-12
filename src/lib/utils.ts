import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string, maxLength = 80): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function initials(name: string): string {
  // Tokens such as "(Demo)" or "—" are not part of a name and never contribute an initial.
  const parts = name.trim().split(/\s+/).filter((part) => /^[\p{L}\p{N}]/u.test(part));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export function formatCount(n: number): string {
  return n < 1000 ? String(n) : compact.format(n);
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(n)} ${n === 1 ? singular : plural}`;
}

type DateInput = Date | string | number;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

/** Compact relative time: "now", "5m", "3h", "2d", "4w", then an absolute date. */
export function timeAgo(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 35) return `${Math.round(days / 7)}w`;
  return formatDate(date, now.getFullYear() === date.getFullYear() ? "short" : "medium");
}

/** Long-form relative time for sentences: "3 days ago". */
export function timeAgoLong(input: DateInput, now: Date = new Date()): string {
  const date = toDate(input);
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// A fixed locale and timezone keep server and client renders identical.
const DATE_FORMATS = {
  short: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
  medium: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
  long: new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
  monthYear: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
  dateTime: new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }),
} as const;

export function formatDate(input: DateInput, style: keyof typeof DATE_FORMATS = "medium"): string {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_FORMATS[style].format(date);
}

/** `YYYY-MM-DD` for <input type="date"> values. */
export function toDateInputValue(input: DateInput | null | undefined): string {
  if (!input) return "";
  const date = toDate(input);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£" };

function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  if (currency === "INR") {
    if (amount >= 10_000_000) return `${symbol}${trimZero(amount / 10_000_000)} Cr`;
    if (amount >= 100_000) return `${symbol}${trimZero(amount / 100_000)} L`;
    return `${symbol}${amount.toLocaleString("en-IN")}`;
  }
  if (amount >= 1_000_000) return `${symbol}${trimZero(amount / 1_000_000)}M`;
  if (amount >= 10_000) return `${symbol}${trimZero(amount / 1000)}k`;
  return `${symbol}${amount.toLocaleString("en-US")}`;
}

const trimZero = (n: number) => n.toFixed(1).replace(/\.0$/, "");

export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined,
): string | null {
  if (!min && !max) return null;
  const cur = currency ?? "USD";
  const per = period === "month" ? "/mo" : period === "hour" ? "/hr" : "/yr";
  if (min && max && min !== max) return `${formatMoney(min, cur)} – ${formatMoney(max, cur)}${per}`;
  return `${formatMoney((min ?? max)!, cur)}${per}`;
}

/** Hostname without `www.` for compact link display. Returns null for invalid URLs. */
export function displayHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function isNonEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Only allow same-origin relative redirect targets (prevents open redirects). */
export function safeRedirectPath(target: string | null | undefined, fallback = "/feed"): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(target)) return fallback;
  return target;
}
