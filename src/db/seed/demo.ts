import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  communities,
  communityMembers,
  companies,
  companyFollows,
  companyMembers,
  connections,
  experiences,
  follows,
  hashtags,
  jobs,
  postHashtags,
  posts,
  profiles,
  users,
} from "@/db/schema";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import type { AchievementType, EmploymentType, ExperienceLevel, JobCategorySlug, PostType, WorkArrangement } from "@/lib/constants";
import { newId } from "@/lib/ids";
import { buildJobSlug, jobFingerprint } from "@/lib/jobs/classify";
import { excerptOf, extractHashtags } from "@/lib/text";
import { slugify } from "@/lib/utils";

/**
 * Optional demonstration data for local development and product walkthroughs.
 *
 * Everything created here is fictional and marked as such: members and organisations carry
 * "(Demo)" in their names and `is_demo = true`, demo jobs show a Demo badge, are excluded from
 * the sitemap and structured data, and nothing is ever marked verified. `purgeDemo` removes
 * all of it. The seed refuses to run in production.
 */

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_DOMAIN = "demo.cybergram.invalid";
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000);

type DemoUser = {
  key: string;
  name: string;
  headline: string;
  title: string;
  company: string;
  location: string;
  country: string;
  years: number;
  domains: string[];
  skills: string[];
  bio: string;
  openToWork?: boolean;
};

const USERS: DemoUser[] = [
  { key: "aarav", name: "Aarav Mehta (Demo)", headline: "SOC Analyst · Detection engineering · Blue team", title: "SOC Analyst L2", company: "Northwind Defence (Demo)", location: "Bengaluru", country: "IN", years: 3, domains: ["soc", "blue-teaming", "threat-intelligence"], skills: ["siem", "splunk", "sigma", "incident-response", "mitre-attack"], bio: "Demo profile. Writes detections, tunes noisy alerts and documents triage playbooks." },
  { key: "priya", name: "Priya Nair (Demo)", headline: "Penetration Tester · Web & API security", title: "Security Consultant", company: "Harbourline Security (Demo)", location: "Kochi", country: "IN", years: 5, domains: ["vapt", "application-security", "bug-bounty"], skills: ["web-app-pentesting", "api-security-testing", "burp-suite", "owasp-top-10", "python"], bio: "Demo profile. Tests web applications and APIs, and mentors people preparing for their first pentest role." },
  { key: "marcus", name: "Marcus Lee (Demo)", headline: "Cloud Security Engineer · AWS · Kubernetes", title: "Cloud Security Engineer", company: "Cinderpeak Cloud (Demo)", location: "Austin, TX", country: "US", years: 7, domains: ["cloud-security", "devsecops"], skills: ["aws-security", "kubernetes-security", "terraform", "iam", "cspm"], bio: "Demo profile. Builds guardrails so teams can ship quickly without opening the perimeter." },
  { key: "sana", name: "Sana Qureshi (Demo)", headline: "Final-year CS student · CTF player · Aspiring red teamer", title: "Student", company: "Demo Institute of Technology", location: "Hyderabad", country: "IN", years: 0, domains: ["ctf", "red-teaming", "general"], skills: ["ctf", "linux", "python", "web-exploitation", "active-directory"], bio: "Demo profile. Plays CTFs most weekends and is looking for a first internship.", openToWork: true },
  { key: "elena", name: "Elena Rossi (Demo)", headline: "Malware Analyst · Reverse engineering · DFIR", title: "Senior Malware Analyst", company: "Northwind Defence (Demo)", location: "Remote", country: "US", years: 9, domains: ["malware-analysis", "digital-forensics", "threat-intelligence"], skills: ["malware-analysis", "reverse-engineering", "ghidra", "yara", "memory-forensics"], bio: "Demo profile. Unpacks samples, writes YARA rules and turns analysis into detections." },
  { key: "dev", name: "Dev Kapoor (Demo)", headline: "GRC Analyst · ISO 27001 · SOC 2", title: "GRC Analyst", company: "Harbourline Security (Demo)", location: "Pune", country: "IN", years: 2, domains: ["grc", "general"], skills: ["iso-27001", "soc-2", "risk-assessment", "security-auditing", "third-party-risk"], bio: "Demo profile. Helps teams pass audits without turning security into paperwork.", openToWork: true },
];

const COMPANIES = [
  { key: "northwind", owner: "aarav", name: "Northwind Defence (Demo)", type: "mssp" as const, tagline: "Fictional managed detection and response provider used for demo data.", hqLocation: "Bengaluru, Karnataka", hqCountry: "IN", size: "201-500" as const, specializations: ["soc", "blue-teaming", "malware-analysis", "threat-intelligence"] },
  { key: "harbourline", owner: "priya", name: "Harbourline Security (Demo)", type: "consulting" as const, tagline: "Fictional offensive security and compliance consultancy used for demo data.", hqLocation: "Kochi, Kerala", hqCountry: "IN", size: "51-200" as const, specializations: ["vapt", "application-security", "grc"] },
  { key: "cinderpeak", owner: "marcus", name: "Cinderpeak Cloud (Demo)", type: "product" as const, tagline: "Fictional cloud security posture product company used for demo data.", hqLocation: "Austin, Texas", hqCountry: "US", size: "51-200" as const, specializations: ["cloud-security", "devsecops", "ai-security"] },
];

type DemoJob = {
  company: string;
  title: string;
  category: JobCategorySlug;
  type: EmploymentType;
  level: ExperienceLevel;
  arrangement: WorkArrangement;
  location: string | null;
  country: string | null;
  salary?: [number, number, "INR" | "USD"];
  skills: string[];
  daysAgo: number;
};

const JOBS: DemoJob[] = [
  { company: "northwind", title: "SOC Analyst Intern", category: "soc-analyst", type: "internship", level: "student", arrangement: "hybrid", location: "Bengaluru, Karnataka", country: "IN", salary: [25000, 35000, "INR"], skills: ["siem", "log-analysis", "alert-triage"], daysAgo: 0 },
  { company: "northwind", title: "SOC Analyst (L1) — Fresher", category: "soc-analyst", type: "full_time", level: "fresher", arrangement: "onsite", location: "Hyderabad, Telangana", country: "IN", salary: [450000, 650000, "INR"], skills: ["siem", "splunk", "incident-response", "mitre-attack"], daysAgo: 1 },
  { company: "northwind", title: "Senior Malware Analyst", category: "malware-analyst", type: "full_time", level: "senior", arrangement: "remote", location: null, country: "US", salary: [140000, 175000, "USD"], skills: ["malware-analysis", "reverse-engineering", "ghidra", "yara"], daysAgo: 3 },
  { company: "harbourline", title: "Junior Penetration Tester", category: "penetration-tester", type: "full_time", level: "junior", arrangement: "hybrid", location: "Kochi, Kerala", country: "IN", salary: [600000, 900000, "INR"], skills: ["web-app-pentesting", "burp-suite", "owasp-top-10", "nmap"], daysAgo: 1 },
  { company: "harbourline", title: "VAPT Intern (Web & API)", category: "vulnerability-assessment-engineer", type: "internship", level: "student", arrangement: "remote", location: null, country: "IN", salary: [20000, 30000, "INR"], skills: ["web-app-pentesting", "api-security-testing", "python"], daysAgo: 2 },
  { company: "harbourline", title: "GRC Analyst — ISO 27001", category: "grc-analyst", type: "full_time", level: "mid", arrangement: "onsite", location: "Pune, Maharashtra", country: "IN", salary: [900000, 1400000, "INR"], skills: ["iso-27001", "risk-assessment", "security-auditing"], daysAgo: 6 },
  { company: "cinderpeak", title: "Cloud Security Engineer", category: "cloud-security-engineer", type: "full_time", level: "mid", arrangement: "remote", location: null, country: "US", salary: [135000, 165000, "USD"], skills: ["aws-security", "kubernetes-security", "terraform", "iam"], daysAgo: 2 },
  { company: "cinderpeak", title: "DevSecOps Engineer", category: "devsecops-engineer", type: "full_time", level: "senior", arrangement: "hybrid", location: "Austin, TX", country: "US", salary: [150000, 185000, "USD"], skills: ["ci-cd-security", "sast", "container-security", "secrets-management"], daysAgo: 5 },
  { company: "cinderpeak", title: "Application Security Engineer — Graduate Programme", category: "application-security-engineer", type: "full_time", level: "fresher", arrangement: "hybrid", location: "Bengaluru, Karnataka", country: "IN", salary: [800000, 1100000, "INR"], skills: ["secure-code-review", "threat-modeling", "owasp-top-10"], daysAgo: 0 },
  { company: "cinderpeak", title: "AI Security Researcher (Contract)", category: "ai-ml-security-engineer", type: "contract", level: "senior", arrangement: "remote", location: null, country: null, skills: ["llm-security", "prompt-injection", "ai-red-teaming"], daysAgo: 4 },
];

const jobDescription = (job: DemoJob, companyName: string) =>
  [
    `> **Demo listing.** This role is fictional and exists only to illustrate the product. ${companyName} is not a real organisation.`,
    "",
    "## About the role",
    `You will join the ${job.category.replace(/-/g, " ")} function and work alongside experienced practitioners on real casework from day one.`,
    "",
    "## What you will do",
    "- Investigate and document findings clearly enough that someone else can act on them",
    "- Improve the tooling, detections or test methodology the team relies on",
    "- Share what you learn with the team through write-ups and reviews",
    "",
    "## What we look for",
    job.level === "student" || job.level === "fresher"
      ? "- Curiosity and evidence of self-driven learning: labs, CTFs, a home lab or write-ups\n- Solid fundamentals in networking, Linux and one scripting language"
      : "- Hands-on experience in a comparable role and the judgement to work without close supervision\n- Clear written communication with technical and non-technical colleagues",
    "",
    "## Hiring process",
    "A short introductory call, a practical exercise based on realistic work, and a conversation with the team. No payment is ever requested from candidates.",
  ].join("\n");

const POSTS: { author: string; company?: string; type: PostType; category: string; daysAgo: number; title?: string; body: string }[] = [
  { author: "aarav", type: "post", category: "soc", daysAgo: 0, body: "Cut our false-positive rate on the PowerShell encoded-command rule by 70% this week. The fix was not a better regex — it was joining on parent process and excluding our own deployment tooling by signer, not by path.\n\nPaths get spoofed. Signers are harder. #detectionengineering #soc #sigma" },
  { author: "priya", type: "post", category: "vapt", daysAgo: 1, body: "Reminder for anyone starting out in API testing: enumerate object IDs across *every* verb, not just GET. I still find more broken object-level authorisation on PATCH and DELETE than anywhere else.\n\nWhat is the first thing you check on a new API? #apisecurity #bugbounty #owasp" },
  { author: "marcus", type: "project", category: "cloud-security", daysAgo: 2, body: "Open-sourced a small Terraform module that enforces IMDSv2, blocks public S3 ACLs and requires encryption on new EBS volumes — with tests.\n\nNothing clever, just the boring guardrails every new AWS account should have on day one. Feedback welcome. #aws #cloudsecurity #terraform" },
  { author: "sana", type: "ctf_writeup", category: "ctf", daysAgo: 3, body: "First time solving a heap challenge without reading a write-up first. The trick was a tcache poisoning primitive hidden behind an off-by-one in the note editor.\n\n```\nedit(0, b'A' * 0x18 + p8(0x41))\n```\n\nTook me nine hours. Worth it. #ctf #pwn #binaryexploitation" },
  { author: "elena", type: "research", category: "malware-analysis", daysAgo: 4, body: "Unpacked a loader this week that checks the number of *recently opened documents* before detonating — a neat sandbox evasion, since analysis VMs rarely have user history.\n\nIf your sandbox images are pristine, they are also fingerprintable. Seed them with realistic artefacts. #malware #reverseengineering #dfir" },
  { author: "dev", type: "post", category: "grc", daysAgo: 5, body: "Unpopular opinion: most ISO 27001 pain is self-inflicted. If a control exists only in a policy document and nobody can show it operating, the audit finding is a gift — it shows you where security is imaginary.\n\n#grc #iso27001 #compliance" },
  { author: "sana", type: "post", category: "general", daysAgo: 6, body: "For students asking how to get noticed without experience: publish. Three honest write-ups of labs you actually did beat a list of course certificates. Recruiters can read your thinking.\n\nWhat helped you land your first role? #cybersecuritycareers #students" },
  { author: "aarav", company: "northwind", type: "career_update", category: "soc", daysAgo: 1, body: "We are opening two early-career roles on our SOC team this month: an internship in Bengaluru and an L1 analyst role in Hyderabad. Both include structured mentoring and a real on-call shadowing rotation.\n\nDetails are on our jobs tab. (Demo announcement.) #hiring #soc" },
  { author: "marcus", type: "post", category: "devsecops", daysAgo: 8, body: "Secrets scanning in CI is table stakes. The step people skip is *revocation drills*: when a key leaks, how long until it is dead everywhere? Time it. Ours took 47 minutes the first time and 6 the third.\n\n#devsecops #secretsmanagement" },
  { author: "priya", type: "disclosure", category: "bug-bounty", daysAgo: 10, body: "Disclosed (and fixed): an account takeover chain in a demo target — password reset tokens were scoped to email, not to user ID, and email change did not invalidate outstanding tokens.\n\nLesson: bind tokens to the immutable identifier. Reported, triaged in a day, patched in four. #responsibledisclosure #bugbounty" },
];

const ARTICLE = {
  author: "elena",
  category: "digital-forensics",
  type: "article" as const,
  daysAgo: 7,
  title: "A practical first hour of memory forensics (demo article)",
  body: `> This is a demo article created by the development seed.

When an alert fires and you have a memory image in hand, the first hour decides whether the investigation converges or sprawls. This is the order I work in.

## 1. Establish the baseline

Before hunting, confirm what you are looking at: OS build, uptime, logged-on users and the time the image was taken. Everything else is interpreted against it.

\`\`\`
vol -f memory.raw windows.info
vol -f memory.raw windows.pslist
\`\`\`

## 2. Processes that should not exist

Compare the process tree against what the host's role predicts. Look for:

- Office or browser processes spawning script interpreters
- Unsigned binaries running from user-writable paths
- Processes whose parent has already exited

## 3. Injected code

\`malfind\` is noisy but fast. Treat every hit as a question, not an answer — JIT compilers and security tools produce legitimate RWX regions.

| Signal | Usually benign | Worth a closer look |
| --- | --- | --- |
| RWX region | Browser JIT | In \`svchost.exe\` |
| No backing file | .NET runtime | With an MZ header |

## 4. Network state

Open sockets and recent connections tie a suspicious process to infrastructure. Record them before you pivot, because you will not remember which PID owned which socket.

## 5. Write it down as you go

A timeline with five solid entries beats fifty screenshots. Note the artefact, where you found it, and what it proves.

*Only analyse images you are authorised to handle, and keep evidence handling records.*`,
};

const ACHIEVEMENTS: { user: string; type: AchievementType; title: string; issuer: string; monthsAgo: number }[] = [
  { user: "priya", type: "certification", title: "Offensive security certification (demo entry)", issuer: "Demo Certification Body", monthsAgo: 14 },
  { user: "sana", type: "ctf", title: "Top 10 finish — Demo University CTF", issuer: "Demo University CTF", monthsAgo: 3 },
  { user: "elena", type: "talk", title: "Speaker — “Sandbox evasion in the wild” (demo entry)", issuer: "Demo Security Conference", monthsAgo: 8 },
  { user: "marcus", type: "open_source", title: "Maintainer — baseline AWS guardrails module (demo entry)", issuer: "Demo open-source project", monthsAgo: 2 },
];

export async function seedDemo(): Promise<{ users: number; posts: number; jobs: number }> {
  if (process.env.NODE_ENV === "production") throw new Error("Demo data cannot be created in production.");
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) throw new Error("Set SEED_DEMO_PASSWORD before seeding demo data.");
  const policy = checkPasswordPolicy(password);
  if (!policy.ok) throw new Error(`SEED_DEMO_PASSWORD is too weak: ${policy.message}`);

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true)).limit(1);
  if (existing) throw new Error("Demo data already exists. Run `npm run db:purge-demo` first to recreate it.");

  const passwordHash = await hashPassword(password);
  const userIds = new Map<string, string>();
  const companyIds = new Map<string, string>();
  let postCount = 0;

  await db.transaction(async (tx) => {
    for (const [index, user] of USERS.entries()) {
      const id = newId();
      userIds.set(user.key, id);
      const joined = ago(40 - index * 3);
      await tx.insert(users).values({
        id,
        email: `${user.key}@${EMAIL_DOMAIN}`,
        username: `demo-${user.key}`,
        name: user.name,
        passwordHash,
        emailVerifiedAt: joined,
        onboardedAt: joined,
        isDemo: true,
        createdAt: joined,
      });
      await tx.insert(profiles).values({
        userId: id,
        headline: user.headline,
        bio: user.bio,
        currentTitle: user.title,
        currentCompany: user.company,
        location: user.location,
        country: user.country,
        yearsExperience: user.years,
        domains: user.domains,
        skills: user.skills,
        openToWork: user.openToWork ?? false,
        openToWorkVisibility: "public",
        recruiterDiscoverable: user.openToWork ?? false,
        // Demo profiles must never reach a search index.
        indexable: false,
      });
      await tx.insert(experiences).values({ userId: id, title: user.title, company: user.company, location: user.location, startDate: `${new Date().getUTCFullYear() - Math.max(user.years, 1)}-06-01`, isCurrent: true });
    }

    for (const company of COMPANIES) {
      const id = newId();
      companyIds.set(company.key, id);
      const ownerId = userIds.get(company.owner)!;
      await tx.insert(companies).values({
        id,
        slug: slugify(company.name),
        name: company.name,
        tagline: company.tagline,
        description: `**This is a demo organisation.** It is fictional and was created by the development seed to illustrate company pages, job listings and the recruiter portal.\n\n${company.tagline}`,
        type: company.type,
        size: company.size,
        hqLocation: company.hqLocation,
        hqCountry: company.hqCountry,
        specializations: company.specializations,
        // Deliberately unverified: verification is only ever granted by an administrator.
        verificationStatus: "unverified",
        createdById: ownerId,
        isDemo: true,
      });
      await tx.insert(companyMembers).values({ companyId: id, userId: ownerId, role: "owner" });
      await tx.update(users).set({ role: "recruiter" }).where(eq(users.id, ownerId));
    }

    for (const job of JOBS) {
      const company = COMPANIES.find((c) => c.key === job.company)!;
      const postedAt = ago(job.daysAgo, 2);
      await tx.insert(jobs).values({
        slug: buildJobSlug(job.title, company.name),
        companyId: companyIds.get(job.company)!,
        companyName: company.name,
        title: job.title,
        description: jobDescription(job, company.name),
        category: job.category,
        employmentType: job.type,
        workArrangement: job.arrangement,
        experienceLevel: job.level,
        location: job.location,
        country: job.country,
        salaryMin: job.salary?.[0],
        salaryMax: job.salary?.[1],
        salaryCurrency: job.salary?.[2],
        salaryPeriod: job.salary ? (job.type === "internship" ? "month" : "year") : null,
        skills: job.skills,
        applyMode: "platform",
        status: "active",
        source: "direct",
        sourceName: company.name,
        fingerprint: jobFingerprint(company.name, job.title, job.location),
        postedAt,
        lastVerifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 45 * DAY),
        postedById: userIds.get(company.owner)!,
        isDemo: true,
        createdAt: postedAt,
      });
    }

    const tagIds = new Map<string, string>();
    const tagFor = async (tag: string) => {
      if (!tagIds.has(tag)) {
        await tx.insert(hashtags).values({ tag }).onConflictDoNothing({ target: hashtags.tag });
        const [row] = await tx.select({ id: hashtags.id }).from(hashtags).where(eq(hashtags.tag, tag)).limit(1);
        tagIds.set(tag, row!.id);
      }
      return tagIds.get(tag)!;
    };
    for (const post of POSTS) {
      const id = newId();
      const createdAt = ago(post.daysAgo, 5);
      await tx.insert(posts).values({
        id,
        authorId: userIds.get(post.author)!,
        companyId: post.company ? companyIds.get(post.company) : null,
        type: post.type,
        category: post.category,
        title: post.title,
        body: post.body,
        excerpt: excerptOf(post.body, 220),
        likeCount: 0,
        createdAt,
      });
      for (const tag of extractHashtags(post.body)) {
        await tx.insert(postHashtags).values({ postId: id, hashtagId: await tagFor(tag), createdAt }).onConflictDoNothing();
      }
      postCount++;
    }
    await tx.insert(posts).values({
      authorId: userIds.get(ARTICLE.author)!,
      type: ARTICLE.type,
      category: ARTICLE.category,
      title: ARTICLE.title,
      slug: `${slugify(ARTICLE.title, 70)}-${newId(6)}`,
      body: ARTICLE.body,
      excerpt: excerptOf(ARTICLE.body, 260),
      createdAt: ago(ARTICLE.daysAgo),
    });
    postCount++;

    for (const item of ACHIEVEMENTS) {
      const date = new Date(Date.now() - item.monthsAgo * 30 * DAY).toISOString().slice(0, 10);
      // Left unverified on purpose: there is no real evidence behind a demo achievement.
      await tx.insert(achievements).values({ userId: userIds.get(item.user)!, type: item.type, title: item.title, issuer: item.issuer, achievedOn: date, featured: true });
    }

    // A small social graph so feeds, suggestions and counters have something to show.
    const keys = USERS.map((u) => u.key);
    const followPairs: [string, string][] = [];
    for (const [i, follower] of keys.entries()) {
      for (const offset of [1, 2]) followPairs.push([follower, keys[(i + offset) % keys.length]!]);
    }
    await tx.insert(follows).values(followPairs.map(([a, b]) => ({ followerId: userIds.get(a)!, followingId: userIds.get(b)! })));
    const pairs: [string, string][] = [["aarav", "elena"], ["priya", "sana"], ["marcus", "dev"], ["aarav", "priya"]];
    await tx.insert(connections).values(
      pairs.map(([a, b]) => {
        const [x, y] = [userIds.get(a)!, userIds.get(b)!];
        return { requesterId: x, addresseeId: y, pairKey: x < y ? `${x}:${y}` : `${y}:${x}`, status: "accepted" as const, respondedAt: ago(10) };
      }),
    );
    for (const user of USERS) {
      const id = userIds.get(user.key)!;
      await tx
        .update(profiles)
        .set({
          followerCount: followPairs.filter(([, b]) => b === user.key).length,
          followingCount: followPairs.filter(([a]) => a === user.key).length,
          connectionCount: pairs.filter(([a, b]) => a === user.key || b === user.key).length,
        })
        .where(eq(profiles.userId, id));
    }
    await tx.insert(companyFollows).values([
      { userId: userIds.get("sana")!, companyId: companyIds.get("northwind")! },
      { userId: userIds.get("dev")!, companyId: companyIds.get("harbourline")! },
    ]);
    await tx.update(companies).set({ followerCount: 1 }).where(inArray(companies.id, [companyIds.get("northwind")!, companyIds.get("harbourline")!]));

    const [students] = await tx.select({ id: communities.id, memberCount: communities.memberCount }).from(communities).where(eq(communities.slug, "cybersecurity-students")).limit(1);
    if (students) {
      const members = ["sana", "dev", "priya"].map((key) => ({ communityId: students.id, userId: userIds.get(key)! }));
      await tx.insert(communityMembers).values(members).onConflictDoNothing();
      await tx.update(communities).set({ memberCount: students.memberCount + members.length }).where(eq(communities.id, students.id));
    }
  });

  return { users: USERS.length, posts: postCount, jobs: JOBS.length };
}

/** Removes everything `seedDemo` created. Cascades take care of posts, follows, applications and so on. */
export async function purgeDemo(): Promise<{ users: number; companies: number; jobs: number }> {
  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.isDemo, true));
  const ids = demoUsers.map((u) => u.id);

  // Community member counters are denormalised, so they are corrected before the rows go.
  if (ids.length > 0) {
    const memberships = await db.select({ communityId: communityMembers.communityId }).from(communityMembers).where(inArray(communityMembers.userId, ids));
    const perCommunity = new Map<string, number>();
    for (const m of memberships) perCommunity.set(m.communityId, (perCommunity.get(m.communityId) ?? 0) + 1);
    for (const [communityId, count] of perCommunity) {
      const [row] = await db.select({ memberCount: communities.memberCount }).from(communities).where(eq(communities.id, communityId)).limit(1);
      if (row) await db.update(communities).set({ memberCount: Math.max(0, row.memberCount - count) }).where(eq(communities.id, communityId));
    }
  }

  const removedJobs = await db.delete(jobs).where(eq(jobs.isDemo, true)).returning({ id: jobs.id });
  const removedCompanies = await db.delete(companies).where(eq(companies.isDemo, true)).returning({ id: companies.id });
  const removedUsers = await db.delete(users).where(eq(users.isDemo, true)).returning({ id: users.id });
  return { users: removedUsers.length, companies: removedCompanies.length, jobs: removedJobs.length };
}
