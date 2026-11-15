/**
 * The security news desk: a fixed, reviewed list of established sources.
 *
 * - `official`: national cyber security agencies.
 * - `research`: security research teams that publish their own findings.
 * - `press`: long-running security news outlets with named reporters and corrections.
 *
 * Each entry is the publisher's own syndication feed. `hosts` pins where an item's link may
 * point: anything in a feed that links elsewhere is discarded, so a compromised or careless
 * feed can never plant an arbitrary link on the home page. Every feed was checked to respond
 * with well-formed items when it was added.
 */
export type NewsSource = {
  key: string;
  name: string;
  kind: "official" | "research" | "press";
  feed: string;
  hosts: readonly string[];
};

export const NEWS_SOURCE_KIND_LABELS = {
  official: "Official advisory",
  research: "Security research",
  press: "Security press",
} as const;

export const NEWS_SOURCES: readonly NewsSource[] = [
  { key: "ncsc-uk", name: "NCSC (UK)", kind: "official", feed: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", hosts: ["ncsc.gov.uk"] },

  { key: "project-zero", name: "Google Project Zero", kind: "research", feed: "https://googleprojectzero.blogspot.com/feeds/posts/default?alt=rss", hosts: ["projectzero.google", "googleprojectzero.blogspot.com"] },
  { key: "sans-isc", name: "SANS Internet Storm Center", kind: "research", feed: "https://isc.sans.edu/rssfeed.xml", hosts: ["isc.sans.edu"] },
  { key: "talos", name: "Cisco Talos", kind: "research", feed: "https://blog.talosintelligence.com/rss/", hosts: ["blog.talosintelligence.com"] },
  { key: "unit42", name: "Palo Alto Networks Unit 42", kind: "research", feed: "https://unit42.paloaltonetworks.com/feed/", hosts: ["unit42.paloaltonetworks.com"] },
  { key: "portswigger", name: "PortSwigger Research", kind: "research", feed: "https://portswigger.net/research/rss", hosts: ["portswigger.net"] },
  { key: "github-security", name: "GitHub Security", kind: "research", feed: "https://github.blog/security/feed/", hosts: ["github.blog"] },
  { key: "cloudflare-security", name: "Cloudflare Security", kind: "research", feed: "https://blog.cloudflare.com/tag/security/rss", hosts: ["blog.cloudflare.com"] },
  { key: "trailofbits", name: "Trail of Bits", kind: "research", feed: "https://blog.trailofbits.com/feed/", hosts: ["blog.trailofbits.com"] },
  { key: "securelist", name: "Kaspersky Securelist", kind: "research", feed: "https://securelist.com/feed/", hosts: ["securelist.com"] },

  { key: "krebs", name: "Krebs on Security", kind: "press", feed: "https://krebsonsecurity.com/feed/", hosts: ["krebsonsecurity.com"] },
  { key: "bleepingcomputer", name: "BleepingComputer", kind: "press", feed: "https://www.bleepingcomputer.com/feed/", hosts: ["bleepingcomputer.com"] },
  { key: "thehackernews", name: "The Hacker News", kind: "press", feed: "https://feeds.feedburner.com/TheHackersNews", hosts: ["thehackernews.com"] },
  { key: "therecord", name: "The Record", kind: "press", feed: "https://therecord.media/feed", hosts: ["therecord.media"] },
  { key: "securityweek", name: "SecurityWeek", kind: "press", feed: "https://www.securityweek.com/feed/", hosts: ["securityweek.com"] },
  { key: "helpnet", name: "Help Net Security", kind: "press", feed: "https://www.helpnetsecurity.com/feed/", hosts: ["helpnetsecurity.com"] },
  { key: "cyberscoop", name: "CyberScoop", kind: "press", feed: "https://cyberscoop.com/feed/", hosts: ["cyberscoop.com"] },
  { key: "schneier", name: "Schneier on Security", kind: "press", feed: "https://www.schneier.com/feed/atom/", hosts: ["schneier.com"] },
];
