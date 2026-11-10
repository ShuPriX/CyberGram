/**
 * Platform taxonomy and enumerations.
 *
 * Everything here is plain data that is safe to import from both server and client code.
 * Content categories are additionally persisted in the `categories` table so administrators
 * can manage them at runtime; this list is the seed and the fallback.
 */

export const APP_NAME = "CyberGram";
export const APP_TAGLINE = "Where Cybersecurity Professionals Connect, Build & Get Hired.";
export const APP_DESCRIPTION =
  "A professional network built exclusively for the cybersecurity community. Showcase your research, share your expertise, connect with security professionals, and discover your next opportunity.";

// ── Roles ────────────────────────────────────────────────────────────────────

export const ROLES = ["user", "recruiter", "moderator", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  user: "Member",
  recruiter: "Recruiter",
  moderator: "Moderator",
  admin: "Administrator",
  super_admin: "Super admin",
};

export type UserStatus = "active" | "suspended" | "deleted";

// ── Content categories (cybersecurity domains) ───────────────────────────────

export const CATEGORIES = [
  { slug: "vapt", name: "VAPT", description: "Vulnerability assessment and penetration testing across web, mobile, network and infrastructure targets." },
  { slug: "red-teaming", name: "Red Teaming", description: "Adversary emulation, initial access, lateral movement, C2 and objective-driven offensive operations." },
  { slug: "blue-teaming", name: "Blue Teaming", description: "Defensive operations, detection engineering, hardening and incident response." },
  { slug: "soc", name: "SOC", description: "Security operations: alert triage, SIEM, SOAR, playbooks and analyst workflows." },
  { slug: "cloud-security", name: "Cloud Security", description: "Securing AWS, Azure, GCP and Kubernetes — identity, posture, workloads and data." },
  { slug: "devsecops", name: "DevSecOps", description: "Security in the delivery pipeline: SAST, DAST, SCA, IaC scanning and supply-chain security." },
  { slug: "application-security", name: "Application Security", description: "Secure design, code review, threat modeling and application-layer vulnerabilities." },
  { slug: "ai-security", name: "AI Security", description: "LLM and ML security: prompt injection, model abuse, adversarial ML and AI red teaming." },
  { slug: "malware-analysis", name: "Malware Analysis", description: "Static and dynamic analysis, reverse engineering, unpacking and detection signatures." },
  { slug: "digital-forensics", name: "Digital Forensics", description: "Disk, memory, network and mobile forensics, evidence handling and DFIR casework." },
  { slug: "threat-intelligence", name: "Threat Intelligence", description: "Threat actor tracking, campaigns, IOCs, TTPs and intelligence-led defence." },
  { slug: "grc", name: "GRC", description: "Governance, risk and compliance: ISO 27001, SOC 2, NIST, PCI DSS, audits and policy." },
  { slug: "osint", name: "OSINT", description: "Open-source intelligence techniques, tooling and investigations." },
  { slug: "bug-bounty", name: "Bug Bounty", description: "Programs, methodology, reports, triage and disclosed findings." },
  { slug: "ctf", name: "CTF", description: "Capture-the-flag write-ups, challenge design, team results and competitive hacking." },
  { slug: "networking", name: "Networking", description: "Network security, protocols, segmentation, firewalls, IDS/IPS and traffic analysis." },
  { slug: "general", name: "General Cybersecurity", description: "Industry news, careers, learning and everything that spans domains." },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as readonly string[];

// ── Posts ────────────────────────────────────────────────────────────────────

export const POST_TYPES = [
  { value: "post", label: "Update", hint: "Share an insight, question or quick update" },
  { value: "article", label: "Article", hint: "Long-form technical writing" },
  { value: "ctf_writeup", label: "CTF write-up", hint: "Challenge walkthroughs and solutions" },
  { value: "research", label: "Research", hint: "Original security research and findings" },
  { value: "disclosure", label: "Responsible disclosure", hint: "A coordinated, already-remediated disclosure" },
  { value: "project", label: "Project", hint: "A tool, repository or build you want to show" },
  { value: "achievement", label: "Achievement", hint: "A certification, win or recognition" },
  { value: "career_update", label: "Career update", hint: "New role, promotion or milestone" },
] as const;
export type PostType = (typeof POST_TYPES)[number]["value"];
export const POST_TYPE_VALUES = POST_TYPES.map((t) => t.value) as [PostType, ...PostType[]];
export const POST_TYPE_LABELS = Object.fromEntries(POST_TYPES.map((t) => [t.value, t.label])) as Record<PostType, string>;

export type PostVisibility = "public" | "connections";
export type ContentStatus = "published" | "hidden" | "removed";

// ── Jobs ─────────────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "apprenticeship", label: "Apprenticeship" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]["value"];
export const EMPLOYMENT_TYPE_VALUES = EMPLOYMENT_TYPES.map((t) => t.value) as [EmploymentType, ...EmploymentType[]];
export const EMPLOYMENT_TYPE_LABELS = Object.fromEntries(EMPLOYMENT_TYPES.map((t) => [t.value, t.label])) as Record<EmploymentType, string>;

export const WORK_ARRANGEMENTS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number]["value"];
export const WORK_ARRANGEMENT_VALUES = WORK_ARRANGEMENTS.map((t) => t.value) as [WorkArrangement, ...WorkArrangement[]];
export const WORK_ARRANGEMENT_LABELS = Object.fromEntries(WORK_ARRANGEMENTS.map((t) => [t.value, t.label])) as Record<WorkArrangement, string>;

export const EXPERIENCE_LEVELS = [
  { value: "student", label: "Student", range: "Currently studying" },
  { value: "fresher", label: "Fresher", range: "0–1 year" },
  { value: "junior", label: "Junior", range: "1–3 years" },
  { value: "mid", label: "Mid-level", range: "3–5 years" },
  { value: "senior", label: "Senior", range: "5–8 years" },
  { value: "lead", label: "Lead & Principal", range: "8+ years" },
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number]["value"];
export const EXPERIENCE_LEVEL_VALUES = EXPERIENCE_LEVELS.map((t) => t.value) as [ExperienceLevel, ...ExperienceLevel[]];
export const EXPERIENCE_LEVEL_LABELS = Object.fromEntries(EXPERIENCE_LEVELS.map((t) => [t.value, t.label])) as Record<ExperienceLevel, string>;
/** Levels surfaced first across the hiring hub. */
export const EARLY_CAREER_LEVELS: ExperienceLevel[] = ["student", "fresher"];

export const JOB_CATEGORIES = [
  { slug: "soc-analyst", name: "SOC Analyst", plural: "SOC analyst", domain: "soc" },
  { slug: "security-analyst", name: "Security Analyst", plural: "Security analyst", domain: "blue-teaming" },
  { slug: "penetration-tester", name: "Penetration Tester", plural: "Penetration testing", domain: "vapt" },
  { slug: "red-team-operator", name: "Red Team Operator", plural: "Red team", domain: "red-teaming" },
  { slug: "vulnerability-assessment-engineer", name: "Vulnerability Assessment Engineer", plural: "Vulnerability assessment", domain: "vapt" },
  { slug: "application-security-engineer", name: "Application Security Engineer", plural: "Application security", domain: "application-security" },
  { slug: "cloud-security-engineer", name: "Cloud Security Engineer", plural: "Cloud security", domain: "cloud-security" },
  { slug: "devsecops-engineer", name: "DevSecOps Engineer", plural: "DevSecOps", domain: "devsecops" },
  { slug: "security-engineer", name: "Security Engineer", plural: "Security engineering", domain: "general" },
  { slug: "security-researcher", name: "Security Researcher", plural: "Security research", domain: "general" },
  { slug: "malware-analyst", name: "Malware Analyst", plural: "Malware analysis", domain: "malware-analysis" },
  { slug: "digital-forensics-analyst", name: "Digital Forensics Analyst", plural: "Digital forensics", domain: "digital-forensics" },
  { slug: "threat-intelligence-analyst", name: "Threat Intelligence Analyst", plural: "Threat intelligence", domain: "threat-intelligence" },
  { slug: "incident-responder", name: "Incident Responder", plural: "Incident response", domain: "blue-teaming" },
  { slug: "grc-analyst", name: "GRC Analyst", plural: "GRC", domain: "grc" },
  { slug: "security-architect", name: "Security Architect", plural: "Security architecture", domain: "general" },
  { slug: "ai-ml-security-engineer", name: "AI/ML Security Engineer", plural: "AI security", domain: "ai-security" },
  { slug: "security-consultant", name: "Security Consultant", plural: "Security consulting", domain: "general" },
  { slug: "security-leadership", name: "CISO & Security Leadership", plural: "Security leadership", domain: "grc" },
  { slug: "other", name: "Other Security Roles", plural: "Security", domain: "general" },
] as const;
export type JobCategorySlug = (typeof JOB_CATEGORIES)[number]["slug"];
export const JOB_CATEGORY_SLUGS = JOB_CATEGORIES.map((c) => c.slug) as [JobCategorySlug, ...JobCategorySlug[]];
export const JOB_CATEGORY_LABELS = Object.fromEntries(JOB_CATEGORIES.map((c) => [c.slug, c.name])) as Record<JobCategorySlug, string>;

export type JobStatus = "draft" | "pending_review" | "active" | "closed" | "filled" | "expired" | "rejected";
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  active: "Active",
  closed: "Closed",
  filled: "Filled",
  expired: "Expired",
  rejected: "Rejected",
};

/** How a listing reached the platform. Always shown to candidates. */
export type JobSource = "direct" | "imported" | "community";
export const JOB_SOURCE_LABELS: Record<JobSource, string> = {
  direct: "Posted by the company",
  imported: "Imported from an external source",
  community: "Community-submitted",
};

export const SALARY_CURRENCIES = ["USD", "INR", "EUR", "GBP"] as const;
export const SALARY_PERIODS = [
  { value: "year", label: "per year" },
  { value: "month", label: "per month" },
  { value: "hour", label: "per hour" },
] as const;

export const APPLICATION_STATUSES = [
  { value: "submitted", label: "Submitted", tone: "neutral" },
  { value: "in_review", label: "In review", tone: "info" },
  { value: "shortlisted", label: "Shortlisted", tone: "primary" },
  { value: "interview", label: "Interview", tone: "primary" },
  { value: "offer", label: "Offer", tone: "success" },
  { value: "hired", label: "Hired", tone: "success" },
  { value: "rejected", label: "Not selected", tone: "danger" },
  { value: "withdrawn", label: "Withdrawn", tone: "neutral" },
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]["value"];
export const APPLICATION_STATUS_VALUES = APPLICATION_STATUSES.map((s) => s.value) as [ApplicationStatus, ...ApplicationStatus[]];
export const APPLICATION_STATUS_META = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s.value, s])) as Record<
  ApplicationStatus,
  (typeof APPLICATION_STATUSES)[number]
>;
/** Statuses a recruiter may move an application to. Candidates withdraw themselves. */
export const RECRUITER_APPLICATION_STATUSES: ApplicationStatus[] = ["in_review", "shortlisted", "interview", "offer", "hired", "rejected"];

export const JOB_SOURCE_KINDS = [
  { value: "greenhouse", label: "Greenhouse job board", configLabel: "Board token", configHint: "The company's board token, e.g. the last segment of boards.greenhouse.io/<token>" },
  { value: "lever", label: "Lever postings", configLabel: "Site name", configHint: "The company's Lever site, e.g. the last segment of jobs.lever.co/<site>" },
  { value: "ashby", label: "Ashby job board", configLabel: "Job board name", configHint: "The company's Ashby board, e.g. the last segment of jobs.ashbyhq.com/<name>" },
  { value: "json_feed", label: "JSON feed (CyberGram format)", configLabel: "Feed URL", configHint: "HTTPS URL returning the documented jobs JSON" },
  { value: "rss", label: "RSS / Atom feed", configLabel: "Feed URL", configHint: "HTTPS URL of an RSS 2.0 or Atom job feed" },
] as const;
export type JobSourceKind = (typeof JOB_SOURCE_KINDS)[number]["value"];
export const JOB_SOURCE_KIND_VALUES = JOB_SOURCE_KINDS.map((k) => k.value) as [JobSourceKind, ...JobSourceKind[]];

export const SOURCE_AUTHORIZATION_BASES = [
  { value: "company_authorized", label: "The company authorised us to list its roles" },
  { value: "public_api_terms", label: "Public job-board API used within its published terms" },
  { value: "partner_feed", label: "Partner feed under a written agreement" },
  { value: "own_company", label: "Our own organisation's postings" },
] as const;
export type SourceAuthorizationBasis = (typeof SOURCE_AUTHORIZATION_BASES)[number]["value"];

// ── Companies ────────────────────────────────────────────────────────────────

export const COMPANY_TYPES = [
  { value: "startup", label: "Cybersecurity startup" },
  { value: "product", label: "Security product company" },
  { value: "enterprise", label: "Enterprise security team" },
  { value: "mssp", label: "MSSP / MDR provider" },
  { value: "consulting", label: "Security consulting firm" },
  { value: "defense", label: "Defense & government contractor" },
  { value: "recruitment", label: "Recruitment agency" },
  { value: "training", label: "Training & certification provider" },
  { value: "other", label: "Other" },
] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number]["value"];
export const COMPANY_TYPE_VALUES = COMPANY_TYPES.map((t) => t.value) as [CompanyType, ...CompanyType[]];
export const COMPANY_TYPE_LABELS = Object.fromEntries(COMPANY_TYPES.map((t) => [t.value, t.label])) as Record<CompanyType, string>;

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Self-reported",
  pending: "Verification pending",
  verified: "Verified",
  rejected: "Not verified",
};

export type CompanyMemberRole = "owner" | "admin" | "recruiter";

// ── Achievements ─────────────────────────────────────────────────────────────

export const ACHIEVEMENT_TYPES = [
  { value: "certification", label: "Certification", plural: "Certifications", issuerLabel: "Issuing body", example: "OSCP — OffSec" },
  { value: "ctf", label: "CTF placement", plural: "CTF record", issuerLabel: "Competition", example: "3rd place — picoCTF 2025" },
  { value: "hackathon", label: "Hackathon", plural: "Hackathons", issuerLabel: "Event", example: "Winner — Smart India Hackathon" },
  { value: "bug_bounty", label: "Bug bounty", plural: "Bug bounty", issuerLabel: "Program / platform", example: "Critical IDOR — HackerOne" },
  { value: "hall_of_fame", label: "Hall of Fame", plural: "Hall of Fame", issuerLabel: "Organisation", example: "Security Hall of Fame — Example Corp" },
  { value: "cve", label: "CVE", plural: "CVEs", issuerLabel: "Affected product", example: "CVE-2025-12345" },
  { value: "disclosure", label: "Responsible disclosure", plural: "Responsible disclosures", issuerLabel: "Vendor", example: "Auth bypass in a public API" },
  { value: "publication", label: "Research publication", plural: "Publications", issuerLabel: "Publisher / venue", example: "Paper, whitepaper or advisory" },
  { value: "talk", label: "Conference talk", plural: "Talks", issuerLabel: "Conference", example: "Speaker — BSides Delhi" },
  { value: "open_source", label: "Open-source contribution", plural: "Open source", issuerLabel: "Project", example: "Maintainer or merged contribution" },
  { value: "award", label: "Award & recognition", plural: "Awards", issuerLabel: "Awarded by", example: "Industry or organisational award" },
  { value: "milestone", label: "Professional milestone", plural: "Milestones", issuerLabel: "Organisation", example: "First security role, promotion…" },
] as const;
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number]["value"];
export const ACHIEVEMENT_TYPE_VALUES = ACHIEVEMENT_TYPES.map((t) => t.value) as [AchievementType, ...AchievementType[]];
export const ACHIEVEMENT_TYPE_META = Object.fromEntries(ACHIEVEMENT_TYPES.map((t) => [t.value, t])) as Record<
  AchievementType,
  (typeof ACHIEVEMENT_TYPES)[number]
>;

// ── Profiles & privacy ───────────────────────────────────────────────────────

export const PROFILE_VISIBILITIES = [
  { value: "public", label: "Public", hint: "Anyone on the internet can view your profile" },
  { value: "members", label: "Members only", hint: "Only signed-in CyberGram members" },
  { value: "private", label: "Connections only", hint: "Only people you are connected with" },
] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number]["value"];

export const MESSAGE_POLICIES = [
  { value: "everyone", label: "Any member" },
  { value: "connections", label: "Connections only" },
  { value: "none", label: "No one" },
] as const;
export type MessagePolicy = (typeof MESSAGE_POLICIES)[number]["value"];

export const OPEN_TO_WORK_VISIBILITIES = [
  { value: "public", label: "Everyone", hint: "Shown as a badge on your profile" },
  { value: "recruiters", label: "Recruiters only", hint: "Visible only to recruiters at verified companies" },
] as const;
export type OpenToWorkVisibility = (typeof OPEN_TO_WORK_VISIBILITIES)[number]["value"];

// ── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  { value: "like", label: "Likes on your posts", group: "Activity", emailDefault: false },
  { value: "comment", label: "Comments on your posts", group: "Activity", emailDefault: true },
  { value: "reply", label: "Replies to your comments", group: "Activity", emailDefault: true },
  { value: "repost", label: "Reposts of your content", group: "Activity", emailDefault: false },
  { value: "mention", label: "Mentions", group: "Activity", emailDefault: true },
  { value: "achievement", label: "Achievement interactions and reviews", group: "Activity", emailDefault: true },
  { value: "follow", label: "New followers", group: "Network", emailDefault: false },
  { value: "connection_request", label: "Connection requests", group: "Network", emailDefault: true },
  { value: "connection_accepted", label: "Accepted connections", group: "Network", emailDefault: false },
  { value: "message", label: "Direct messages", group: "Messages", emailDefault: true },
  { value: "recruiter_message", label: "Messages from recruiters", group: "Messages", emailDefault: true },
  { value: "application_update", label: "Application status updates", group: "Jobs", emailDefault: true },
  { value: "new_applicant", label: "New applicants (recruiters)", group: "Jobs", emailDefault: true },
  { value: "job_alert", label: "Job alerts", group: "Jobs", emailDefault: true },
  { value: "company_post", label: "Announcements from companies you follow", group: "Jobs", emailDefault: false },
  { value: "system", label: "Account and moderation notices", group: "Account", emailDefault: true },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["value"];
export type NotificationPrefs = Partial<Record<NotificationType, { inApp?: boolean; email?: boolean }>>;

// ── Moderation ───────────────────────────────────────────────────────────────

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or misleading" },
  { value: "scam", label: "Scam, fraud or fake job" },
  { value: "impersonation", label: "Impersonation or fake account" },
  { value: "harassment", label: "Harassment or hate" },
  { value: "malicious", label: "Malware, phishing or malicious link" },
  { value: "illegal", label: "Illegal activity or unauthorised disclosure" },
  { value: "misinformation", label: "False or unverifiable claim" },
  { value: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export const REPORT_REASON_VALUES = REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]];
export type ReportTargetType = "post" | "comment" | "user" | "job" | "company" | "message";
export const REPORT_TARGET_TYPES: [ReportTargetType, ...ReportTargetType[]] = ["post", "comment", "user", "job", "company", "message"];
/** Content is hidden pending review once this many distinct members report it. */
export const AUTO_HIDE_REPORT_THRESHOLD = 5;

// ── Learning & events ────────────────────────────────────────────────────────

export const EVENT_TYPES = [
  { value: "conference", label: "Conference" },
  { value: "ctf", label: "CTF" },
  { value: "competition", label: "Competition" },
  { value: "training", label: "Training" },
  { value: "meetup", label: "Meetup" },
  { value: "webinar", label: "Webinar" },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]["value"];
export const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value) as [EventType, ...EventType[]];
export const EVENT_TYPE_LABELS = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.label])) as Record<EventType, string>;

export const RESOURCE_TYPES = [
  { value: "lab", label: "Hands-on lab" },
  { value: "course", label: "Course" },
  { value: "guide", label: "Guide / standard" },
  { value: "tool", label: "Tool" },
  { value: "blog", label: "Blog / write-ups" },
  { value: "paper", label: "Paper" },
  { value: "video", label: "Video" },
  { value: "book", label: "Book" },
  { value: "cheatsheet", label: "Cheat sheet" },
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number]["value"];
export const RESOURCE_TYPE_VALUES = RESOURCE_TYPES.map((t) => t.value) as [ResourceType, ...ResourceType[]];
export const RESOURCE_TYPE_LABELS = Object.fromEntries(RESOURCE_TYPES.map((t) => [t.value, t.label])) as Record<ResourceType, string>;

export const RESOURCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ResourceLevel = (typeof RESOURCE_LEVELS)[number];

export type ModerationStatus = "pending" | "approved" | "rejected";

// ── Countries ────────────────────────────────────────────────────────────────

/** Primary hiring markets, listed first everywhere. */
export const PRIMARY_COUNTRIES = ["IN", "US"] as const;

export const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AR", name: "Argentina" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "BD", name: "Bangladesh" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "KR", name: "South Korea" },
  { code: "LK", name: "Sri Lanka" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NG", name: "Nigeria" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NP", name: "Nepal" },
  { code: "NZ", name: "New Zealand" },
  { code: "PH", name: "Philippines" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Türkiye" },
  { code: "TW", name: "Taiwan" },
  { code: "UA", name: "Ukraine" },
  { code: "VN", name: "Vietnam" },
  { code: "ZA", name: "South Africa" },
] as const;
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as readonly string[];
export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c.name]));
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_NAMES[code] ?? code;
}

// ── Skills catalog ───────────────────────────────────────────────────────────

/**
 * Canonical skill catalog. Profiles and jobs store skill *slugs*; members may add skills
 * outside this list (they are slugified and shown title-cased). Extend freely.
 */
export const SKILLS = [
  // Offensive
  ["web-app-pentesting", "Web App Pentesting"], ["api-security-testing", "API Security Testing"],
  ["mobile-app-pentesting", "Mobile App Pentesting"], ["network-pentesting", "Network Pentesting"],
  ["active-directory", "Active Directory"], ["privilege-escalation", "Privilege Escalation"],
  ["exploit-development", "Exploit Development"], ["social-engineering", "Social Engineering"],
  ["adversary-emulation", "Adversary Emulation"], ["c2-frameworks", "C2 Frameworks"],
  ["burp-suite", "Burp Suite"], ["nmap", "Nmap"], ["metasploit", "Metasploit"], ["cobalt-strike", "Cobalt Strike"],
  ["bloodhound", "BloodHound"], ["nessus", "Nessus"], ["owasp-top-10", "OWASP Top 10"], ["wireless-security", "Wireless Security"],
  // Defensive / SOC
  ["siem", "SIEM"], ["splunk", "Splunk"], ["elastic-security", "Elastic Security"], ["microsoft-sentinel", "Microsoft Sentinel"],
  ["qradar", "IBM QRadar"], ["edr", "EDR"], ["crowdstrike-falcon", "CrowdStrike Falcon"],
  ["microsoft-defender", "Microsoft Defender"], ["soar", "SOAR"], ["incident-response", "Incident Response"],
  ["threat-hunting", "Threat Hunting"], ["detection-engineering", "Detection Engineering"], ["log-analysis", "Log Analysis"],
  ["mitre-attack", "MITRE ATT&CK"], ["sigma", "Sigma Rules"], ["yara", "YARA"], ["alert-triage", "Alert Triage"],
  ["vulnerability-management", "Vulnerability Management"], ["qualys", "Qualys"], ["tenable", "Tenable"],
  // DFIR / malware
  ["digital-forensics", "Digital Forensics"], ["memory-forensics", "Memory Forensics"], ["disk-forensics", "Disk Forensics"],
  ["volatility", "Volatility"], ["autopsy", "Autopsy"], ["malware-analysis", "Malware Analysis"],
  ["reverse-engineering", "Reverse Engineering"], ["ghidra", "Ghidra"], ["ida-pro", "IDA Pro"], ["x64dbg", "x64dbg"],
  ["sandbox-analysis", "Sandbox Analysis"],
  // Intel / OSINT
  ["threat-intelligence", "Threat Intelligence"], ["osint", "OSINT"], ["maltego", "Maltego"], ["shodan", "Shodan"],
  ["dark-web-monitoring", "Dark Web Monitoring"],
  // Cloud / DevSecOps
  ["aws-security", "AWS Security"], ["azure-security", "Azure Security"], ["gcp-security", "GCP Security"],
  ["kubernetes-security", "Kubernetes Security"], ["container-security", "Container Security"], ["terraform", "Terraform"],
  ["iac-security", "IaC Security"], ["cspm", "CSPM"], ["iam", "Identity & Access Management"], ["zero-trust", "Zero Trust"],
  ["sast", "SAST"], ["dast", "DAST"], ["sca", "Software Composition Analysis"], ["ci-cd-security", "CI/CD Security"],
  ["secrets-management", "Secrets Management"], ["supply-chain-security", "Supply Chain Security"],
  // AppSec
  ["secure-code-review", "Secure Code Review"], ["threat-modeling", "Threat Modeling"], ["secure-sdlc", "Secure SDLC"],
  ["oauth-oidc", "OAuth & OIDC"], ["cryptography", "Cryptography"], ["pki", "PKI"],
  // AI
  ["llm-security", "LLM Security"], ["prompt-injection", "Prompt Injection"], ["adversarial-ml", "Adversarial ML"],
  ["ai-red-teaming", "AI Red Teaming"],
  // GRC
  ["iso-27001", "ISO 27001"], ["soc-2", "SOC 2"], ["nist-csf", "NIST CSF"], ["pci-dss", "PCI DSS"], ["gdpr", "GDPR"],
  ["dpdp-act", "DPDP Act"], ["hipaa", "HIPAA"], ["risk-assessment", "Risk Assessment"], ["security-auditing", "Security Auditing"],
  ["security-awareness", "Security Awareness"], ["third-party-risk", "Third-Party Risk"],
  // Network / systems
  ["network-security", "Network Security"], ["tcp-ip", "TCP/IP"], ["firewalls", "Firewalls"], ["ids-ips", "IDS/IPS"],
  ["waf", "WAF"], ["wireshark", "Wireshark"], ["linux", "Linux"], ["windows-internals", "Windows Internals"],
  // Languages
  ["python", "Python"], ["bash", "Bash"], ["powershell", "PowerShell"], ["go", "Go"], ["c-cpp", "C/C++"],
  ["javascript", "JavaScript"], ["rust", "Rust"], ["sql", "SQL"], ["assembly", "Assembly"],
  // Competitive
  ["ctf", "CTF"], ["binary-exploitation", "Binary Exploitation"], ["web-exploitation", "Web Exploitation"],
  ["bug-bounty", "Bug Bounty"],
] as const satisfies readonly (readonly [string, string])[];

const SKILL_LABELS: Record<string, string> = Object.fromEntries(SKILLS);
export const SKILL_OPTIONS = SKILLS.map(([slug, name]) => ({ slug, name }));

export function skillLabel(slug: string): string {
  const known = SKILL_LABELS[slug];
  if (known) return known;
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

// ── Limits ───────────────────────────────────────────────────────────────────

export const LIMITS = {
  postBody: 5000,
  articleBody: 60_000,
  commentBody: 2000,
  messageBody: 4000,
  bio: 2600,
  headline: 160,
  attachmentsPerPost: 6,
  skillsPerProfile: 40,
  skillsPerJob: 20,
  resumesPerUser: 5,
  feedPageSize: 12,
  jobsPageSize: 20,
} as const;

/** Handles that could be used to impersonate the platform or its staff. */
export const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help", "security", "abuse", "staff", "team",
  "moderator", "mod", "official", "verified", "cybergram", "cyber-gram", "api", "www", "mail", "null",
  "undefined", "me", "you", "settings", "login", "register", "about", "contact", "jobs", "feed", "explore",
  "privacy", "terms", "legal", "press", "careers", "status", "recruiter", "billing", "noreply", "no-reply",
]);
