import { LinkTabs } from "@/components/ui/misc";

const ITEMS = [
  { value: "browse", label: "Browse jobs", href: "/jobs" },
  { value: "saved", label: "Saved", href: "/jobs/saved" },
  { value: "applications", label: "Applications", href: "/jobs/applications" },
  { value: "alerts", label: "Alerts", href: "/jobs/alerts" },
  { value: "resumes", label: "Résumés", href: "/jobs/resumes" },
];

/** Section navigation for the hiring hub. Visitors only see Browse. */
export function JobsNav({ current, signedIn }: { current: string; signedIn: boolean }) {
  if (!signedIn) return null;
  return <LinkTabs items={ITEMS} current={current} />;
}

/** Search-param helpers shared by the jobs list and its landing pages. */
export type RawParams = Record<string, string | string[] | undefined>;

export const many = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]).filter(Boolean).slice(0, 12);
export const one = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value) || undefined;

/** Rebuilds a query string from the current filters, overriding or removing some keys. */
export function withParams(base: string, params: RawParams, overrides: Record<string, string | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key in overrides) continue;
    for (const item of many(value)) query.append(key, item);
  }
  for (const [key, value] of Object.entries(overrides)) if (value !== null) query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}
