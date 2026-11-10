/**
 * Heuristic assessment of outbound links in member content.
 *
 * Pure and dependency-free so the same logic runs when a post is created (to flag it for
 * moderators) and on the /leaving interstitial (to warn the reader). These are signals, not
 * verdicts: nothing here contacts the destination.
 */

export type LinkLevel = "ok" | "caution" | "danger";
export type LinkAssessment = {
  url: string;
  host: string;
  level: LinkLevel;
  reasons: string[];
};

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "shorturl.at", "ow.ly", "buff.ly",
  "rebrand.ly", "tiny.cc", "lnkd.in", "t.ly", "shorte.st", "adf.ly", "v.gd", "s.id", "urlz.fr", "qr.ae",
]);

// TLDs that read like file extensions and are routinely used to disguise downloads.
const CONFUSABLE_TLDS = new Set(["zip", "mov", "app.zip"]);

const EXECUTABLE_EXTENSIONS = /\.(exe|scr|msi|msix|bat|cmd|com|pif|ps1|vbs|vbe|js|jse|wsf|hta|jar|apk|dmg|pkg|iso|img|lnk|reg|dll)$/i;

// Well-known sign-in brands. A link whose host *contains* one of these domains as a prefix
// (e.g. "github.com.account-verify.example") is a classic look-alike.
const IMPERSONATED_DOMAINS = [
  "google.com", "accounts.google.com", "microsoft.com", "microsoftonline.com", "live.com", "office.com",
  "apple.com", "icloud.com", "github.com", "gitlab.com", "linkedin.com", "paypal.com", "amazon.com",
  "facebook.com", "instagram.com", "whatsapp.com", "telegram.org", "binance.com", "coinbase.com",
  "hackerone.com", "bugcrowd.com", "okta.com", "dropbox.com", "docusign.com", "netflix.com",
];

function isIpLiteral(host: string): boolean {
  if (host.startsWith("[") && host.endsWith("]")) return true; // IPv6
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

export function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

/** Returns null when the value is not an http(s) URL at all (and therefore never linked). */
export function assessLink(raw: string): LinkAssessment | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const reasons: string[] = [];
  let level: LinkLevel = "ok";
  const raise = (to: LinkLevel, reason: string) => {
    reasons.push(reason);
    if (to === "danger" || (to === "caution" && level === "ok")) level = to;
  };

  if (url.username || url.password) {
    raise("danger", "The address embeds a username before the real host — a common way to disguise where a link goes.");
  }

  if (isIpLiteral(host)) {
    raise("danger", "The link points to a raw IP address instead of a domain name.");
  }

  for (const brand of IMPERSONATED_DOMAINS) {
    if (host !== brand && !host.endsWith(`.${brand}`) && (host.startsWith(`${brand}.`) || host.includes(`.${brand}.`))) {
      raise("danger", `The address contains "${brand}" but is not hosted on ${brand}.`);
      break;
    }
  }

  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    raise("caution", "The domain uses internationalised characters that can imitate other letters.");
  }

  if (SHORTENERS.has(host)) {
    raise("caution", "This is a shortened link, so its real destination is hidden.");
  }

  const tld = host.split(".").at(-1) ?? "";
  if (CONFUSABLE_TLDS.has(tld)) {
    raise("caution", `The ".${tld}" domain ending looks like a file extension.`);
  }

  if (url.protocol === "http:") {
    raise("caution", "The connection is not encrypted (http).");
  }

  if (url.port && !["80", "443"].includes(url.port)) {
    raise("caution", `The link uses a non-standard port (${url.port}).`);
  }

  if (EXECUTABLE_EXTENSIONS.test(url.pathname)) {
    raise("caution", "The link downloads an executable or installer file.");
  }

  if (host.split(".").length > 5) {
    raise("caution", "The domain has an unusually long chain of subdomains.");
  }

  return { url: url.toString(), host, level, reasons };
}

export function worstLinkLevel(urls: string[]): { level: LinkLevel; flagged: LinkAssessment[] } {
  const flagged: LinkAssessment[] = [];
  let level: LinkLevel = "ok";
  for (const raw of urls) {
    const result = assessLink(raw);
    if (!result || result.level === "ok") continue;
    flagged.push(result);
    if (result.level === "danger") level = "danger";
    else if (level === "ok") level = "caution";
  }
  return { level, flagged };
}

/** Same-origin interstitial that shows members where an external link really goes. */
export function leavingHref(url: string): string {
  return `/leaving?url=${encodeURIComponent(url)}`;
}
