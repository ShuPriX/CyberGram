import { createHash } from "node:crypto";
import type { EmploymentType, ExperienceLevel, JobCategorySlug, WorkArrangement } from "../constants";
import { shortId } from "../ids";
import { slugify } from "../utils";

/**
 * Pure classification helpers for imported listings. Company job boards publish every role
 * they have; these functions decide which ones are security roles and normalise them into the
 * platform's taxonomy. Everything is deterministic and unit-tested.
 */

const SECURITY_TITLE =
  /\b(security|secops|devsecops|appsec|infosec|cyber\w*|soc|siem|pentest\w*|penetration|red[\s-]?team\w*|blue[\s-]?team\w*|purple[\s-]?team\w*|threat|vulnerabilit\w+|malware|forensic\w*|dfir|incident\s+respon\w+|detection|grc|ciso|cryptograph\w*|offensive|reverse\s+engineer\w*|iam|identity\s+(and|&)\s+access|zero\s+trust|bug\s+bounty|exploit\w*)\b/i;

// Titles that mention "security" but are not security roles.
const NOT_SECURITY = /\b(security\s+(guard|officer\s+-\s+site|deposit)|physical\s+security\s+guard|social\s+security|job\s+security)\b/i;

// Commercial and support roles at security vendors. Their titles often contain "security" or
// "cyber", but they are not security practitioner jobs and do not belong on this board.
const NOT_PRACTITIONER =
  /\b(sales|account\s+(executive|manager|director)|business\s+development|bdr|sdr|marketing|demand\s+gen\w*|customer\s+success|renewals?|partner\s+(manager|sales|marketing)|channel|alliances?|recruit\w*|talent|people\s+(partner|ops|operations)|product\s+(manager|management|marketing|design\w*)|product\s+owner|ux|ui\s+designer|graphic|copywriter|content\s+(writer|marketing|strateg\w+)|technical\s+writer|counsel|paralegal|legal|accountant|accounting|finance|financial\s+analyst|payroll|procurement|executive\s+assistant|office\s+manager|facilit\w+|workplace|events?\s+(manager|coordinator)|field\s+cto|evangelist|community\s+manager)\b/i;

export function isSecurityRole(title: string, department?: string | null): boolean {
  if (NOT_SECURITY.test(title) || NOT_PRACTITIONER.test(title)) return false;
  return SECURITY_TITLE.test(title) || (department ? /\b(security|infosec|trust\s*&?\s*safety\s+engineering)\b/i.test(department) : false);
}

const CATEGORY_RULES: [RegExp, JobCategorySlug][] = [
  [/\b(ciso|chief\s+information\s+security|head\s+of\s+(information\s+)?security|vp[,\s]+(of\s+)?security|director[,\s]+(of\s+)?(information\s+)?security|security\s+director)\b/i, "security-leadership"],
  [/\b(ai|ml|llm|machine\s+learning|genai)\b.*\b(security|red\s*team|safety)\b|\b(security|red\s*team)\b.*\b(ai|ml|llm|machine\s+learning)\b/i, "ai-ml-security-engineer"],
  [/\bsoc\b|security\s+operations\s+(center|centre|analyst)/i, "soc-analyst"],
  [/\b(pentest\w*|penetration\s+test\w*|ethical\s+hack\w*|offensive\s+security\s+(engineer|consultant))\b/i, "penetration-tester"],
  [/\b(red[\s-]?team\w*|adversary\s+(emulation|simulation))\b/i, "red-team-operator"],
  [/\b(vulnerabilit\w+\s+(assessment|management|analyst|engineer)|vapt|va\/pt)\b/i, "vulnerability-assessment-engineer"],
  [/\b(appsec|application\s+security|product\s+security|secure\s+code)\b/i, "application-security-engineer"],
  [/\b(devsecops|secdevops|pipeline\s+security|supply\s+chain\s+security)\b/i, "devsecops-engineer"],
  [/\b(cloud\s+security|aws\s+security|azure\s+security|gcp\s+security|kubernetes\s+security)\b/i, "cloud-security-engineer"],
  [/\b(malware|reverse\s+engineer\w*)\b/i, "malware-analyst"],
  [/\b(forensic\w*|dfir)\b/i, "digital-forensics-analyst"],
  [/\b(threat\s+intel\w*|cti|threat\s+research\w*)\b/i, "threat-intelligence-analyst"],
  [/\b(incident\s+respon\w+|csirt|cert\s+analyst)\b/i, "incident-responder"],
  [/\b(grc|governance|compliance|risk\s+(analyst|manager)|audit\w*|iso\s*27001|privacy)\b/i, "grc-analyst"],
  [/\bsecurity\s+architect\w*\b/i, "security-architect"],
  [/\bsecurity\s+(consultant|advisor|advisory)\b/i, "security-consultant"],
  [/\b(security\s+research\w*|vulnerability\s+research\w*|exploit\w*)\b/i, "security-researcher"],
  [/\b(security|cyber\w*|information\s+security)\s+analyst\b/i, "security-analyst"],
  [/\b(security|cyber\w*|infosec|detection|iam)\b.*\bengineer\w*\b|\bengineer\w*\b.*\bsecurity\b/i, "security-engineer"],
];

export function classifyCategory(title: string): JobCategorySlug {
  for (const [pattern, category] of CATEGORY_RULES) if (pattern.test(title)) return category;
  return "other";
}

export function classifyEmploymentType(title: string, hint?: string | null): EmploymentType {
  const text = `${title} ${hint ?? ""}`;
  if (/\b(intern|internship|trainee|co-?op|summer\s+analyst)\b/i.test(text)) return "internship";
  if (/\bapprentice\w*\b/i.test(text)) return "apprenticeship";
  if (/\b(freelance|gig)\b/i.test(text)) return "freelance";
  if (/\b(contract|contractor|temporary|temp|fixed[\s-]term|c2c)\b/i.test(text)) return "contract";
  if (/\bpart[\s-]?time\b/i.test(text)) return "part_time";
  return "full_time";
}

export function classifyLevel(title: string, employmentType: EmploymentType): ExperienceLevel {
  if (employmentType === "internship" || employmentType === "apprenticeship") return "student";
  if (/\b(ciso|chief|head\s+of|vp|vice\s+president|director|principal|distinguished|fellow|lead|manager|architect)\b/i.test(title)) return "lead";
  if (/\b(senior|sr\.?|staff|l3|tier\s*3|iii)\b/i.test(title)) return "senior";
  if (/\b(fresher|graduate|new\s+grad|entry[\s-]level|trainee|campus)\b/i.test(title)) return "fresher";
  if (/\b(junior|jr\.?|associate|l1|tier\s*1|\bi\b)\b/i.test(title)) return "junior";
  return "mid";
}

export function classifyArrangement(location: string | null | undefined, hint?: string | null): WorkArrangement {
  const text = `${hint ?? ""} ${location ?? ""}`;
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(remote|work\s+from\s+home|wfh|anywhere|distributed|telecommut\w*)\b/i.test(text)) return "remote";
  return "onsite";
}

const INDIA =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|chennai|delhi|new\s+delhi|ncr|gurgaon|gurugram|noida|kolkata|ahmedabad|jaipur|kochi|cochin|thiruvananthapuram|trivandrum|chandigarh|indore|coimbatore|bhubaneswar|nagpur|lucknow|mohali|vadodara|karnataka|maharashtra|telangana|tamil\s+nadu|kerala|haryana|uttar\s+pradesh|west\s+bengal|gujarat|odisha)\b/i;

const US_STATES =
  /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const USA =
  /\b(united\s+states|usa|u\.s\.a?\.?|us[\s-]remote|remote[\s,-]+us|new\s+york|san\s+francisco|bay\s+area|seattle|austin|boston|chicago|los\s+angeles|washington,?\s+d\.?c\.?|denver|atlanta|dallas|houston|miami|san\s+diego|san\s+jose|portland|phoenix|raleigh|reston|mclean|arlington|california|texas|virginia|massachusetts|colorado|florida|georgia|illinois|maryland)\b/i;

const OTHER_COUNTRIES: [RegExp, string][] = [
  [/\b(united\s+kingdom|uk|england|london|manchester|edinburgh|scotland)\b/i, "GB"],
  [/\b(canada|toronto|vancouver|montreal|ottawa)\b/i, "CA"],
  [/\b(germany|berlin|munich|frankfurt|hamburg)\b/i, "DE"],
  [/\b(singapore)\b/i, "SG"],
  [/\b(australia|sydney|melbourne|brisbane)\b/i, "AU"],
  [/\b(ireland|dublin)\b/i, "IE"],
  [/\b(netherlands|amsterdam)\b/i, "NL"],
  [/\b(france|paris)\b/i, "FR"],
  [/\b(israel|tel\s+aviv)\b/i, "IL"],
  [/\b(uae|united\s+arab\s+emirates|dubai|abu\s+dhabi)\b/i, "AE"],
  [/\b(japan|tokyo)\b/i, "JP"],
  [/\b(poland|warsaw|krakow)\b/i, "PL"],
  [/\b(spain|madrid|barcelona)\b/i, "ES"],
  [/\b(brazil|são\s+paulo|sao\s+paulo)\b/i, "BR"],
  [/\b(mexico)\b/i, "MX"],
];

/** Best-effort country from a free-text location. Returns null rather than guessing. */
export function detectCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  // India first: the two-letter code "IN" (Indiana) must not shadow an explicit Indian city.
  if (INDIA.test(location)) return "IN";
  if (USA.test(location) || US_STATES.test(location)) return "US";
  for (const [pattern, code] of OTHER_COUNTRIES) if (pattern.test(location)) return code;
  return null;
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(inc|llc|ltd|limited|pvt|private|corp|corporation|gmbh|plc|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Identity of a role independent of where it was found. Two listings with the same company,
 * title and location are treated as the same opening, whichever source they came from.
 */
export function jobFingerprint(companyName: string, title: string, location: string | null | undefined): string {
  return createHash("sha256")
    .update(`${normalise(companyName)}|${normalise(title)}|${normalise(location ?? "")}`)
    .digest("hex")
    .slice(0, 40);
}

export function buildJobSlug(title: string, companyName: string): string {
  return `${slugify(`${title} ${companyName}`, 90)}-${shortId(8)}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Converts third-party HTML into plain Markdown. Imported descriptions are untrusted, so no
 * markup survives: scripts and styles are dropped with their content, structure is mapped to
 * Markdown, every remaining tag is removed, and the result is rendered through the Markdown
 * component (which never emits raw HTML).
 */
export function htmlToMarkdown(input: string, maxLength = 20_000): string {
  // Some APIs (Greenhouse) return HTML that is itself entity-encoded.
  let html = /&lt;\w+/.test(input) && !/<\w+[^>]*>/.test(input) ? decodeEntities(input) : input;

  html = html
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|form)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ");

  html = html
    .replace(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi, (_m, inner: string) => `\n\n### ${inner.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li\s*>/gi, "")
    .replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|tr|table|blockquote)\b[^>]*>/gi, "\n\n")
    .replace(/<(strong|b)\b[^>]*>\s*([\s\S]*?)\s*<\/\1\s*>/gi, (_m, _t, inner: string) => (inner.trim() ? `**${inner.trim()}**` : ""))
    .replace(/<a\b[^>]*\bhref\s*=\s*["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a\s*>/gi, (_m, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").trim();
      return label ? `[${label.replace(/[[\]]/g, "")}](${href.replace(/[()]/g, "")})` : "";
    })
    .replace(/<[^>]*>/g, "");

  const text = decodeEntities(html)
    .replace(/[<>]/g, "") // anything that still looks like markup after decoding
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^- *$/gm, "")
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}…` : text;
}
