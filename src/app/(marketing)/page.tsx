import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { countDistinct } from "drizzle-orm";
import { jobLocationLabel } from "@/components/jobs/job-card";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_DESCRIPTION, APP_NAME, EXPERIENCE_LEVEL_LABELS } from "@/lib/constants";
import { pageMetadata, platformOrganizationLd, websiteLd } from "@/lib/seo";
import { formatCount } from "@/lib/utils";
import { getJobFacetCounts, listJobs, openJobCondition } from "@/server/queries/jobs";
import { getCategoryPostCounts } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${APP_NAME} — The Professional Network for Cybersecurity`,
    description: APP_DESCRIPTION,
    path: "/",
  }),
  title: { absolute: `${APP_NAME} — The Professional Network for Cybersecurity` },
};

const BOARD_STEPS = [
  {
    title: "Employer boards, read at the source",
    body: "We follow the public job boards that security teams already publish through their hiring systems, and pull in only the security roles. No company has to sign up for its openings to appear.",
  },
  {
    title: "Re-checked twice a day",
    body: "Each board is read again every twelve hours. New roles are added, changed ones are updated, and a role that disappears from the employer’s board is closed here on the next pass.",
  },
  {
    title: "Posted directly, or sent in by members",
    body: "Organisations can register and post roles themselves. Members can submit an opening they found; a moderator opens the employer’s page and confirms it before it is listed.",
  },
  {
    title: "Every listing says where it came from",
    body: "Posted by the company, imported from its board, or community-submitted — the label and a link to the original are on every job. Listings that ask candidates for money are held back.",
  },
];

const WHAT_IS_HERE = [
  { label: "feed", href: "/explore", body: "Write-ups, research, detections and questions, filed by security domain rather than by who shouts loudest." },
  { label: "profiles", href: "/register", body: "Certifications, CTF placements, CVEs, bounties and talks, each with an evidence link and a plain statement of whether it was verified." },
  { label: "jobs", href: "/jobs", body: "Open roles across SOC, VAPT, red team, cloud, AppSec, DFIR, threat intel and GRC, with internships and fresher roles listed first." },
  { label: "communities", href: "/communities", body: "Rooms for bug bounty, blue team, cloud, AppSec, AI security, forensics, CTF and people starting out." },
  { label: "learn", href: "/learn", body: "Roadmaps you can tick off, free labs and courses recommended by practitioners, and upcoming CTFs and conferences." },
  { label: "hiring", href: "/recruiter", body: "Organisation pages, applicant tracking and candidate search limited to verified employers and members who opted in." },
];

const GROUND_RULES = [
  { title: "Nothing is made up", body: "No invented members, companies, listings or numbers. The figures on this page are counted from the database when the page loads." },
  { title: "No pay-to-apply", body: "A listing that asks for a fee, a deposit or paid training is flagged before anyone sees it. Report anything that slips through." },
  { title: "Verified means a person checked", body: "Achievements and organisations are self-reported until a reviewer has opened the evidence. Nothing is verified automatically." },
  { title: "Disclose responsibly", body: "Share what you are authorised to share. No live targets, credentials or personal data." },
  { title: "Your data stays yours", body: "You choose who sees your profile, whether recruiters can find you and who can message you. Résumés go only to employers you apply to." },
];

const JOB_LINKS = [
  { href: "/cybersecurity-jobs/india", label: "India" },
  { href: "/cybersecurity-jobs/usa", label: "United States" },
  { href: "/cybersecurity-jobs/remote", label: "Remote" },
  { href: "/cybersecurity-jobs/internships", label: "Internships" },
  { href: "/cybersecurity-jobs/entry-level", label: "Entry-level" },
  { href: "/cybersecurity-jobs/soc-analyst", label: "SOC analyst" },
  { href: "/cybersecurity-jobs/penetration-tester", label: "Penetration testing" },
  { href: "/cybersecurity-jobs/vulnerability-assessment-engineer", label: "VAPT" },
  { href: "/cybersecurity-jobs/security-analyst", label: "Security analyst" },
  { href: "/cybersecurity-jobs/cloud-security-engineer", label: "Cloud security" },
  { href: "/cybersecurity-jobs/application-security-engineer", label: "AppSec" },
  { href: "/cybersecurity-jobs/grc-analyst", label: "GRC" },
];

const SHELL = "mx-auto w-full max-w-[1760px] px-4 sm:px-6 xl:px-10";

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <p className="label-mono flex items-center gap-3 text-primary">
      <span>{index}</span>
      <span className="h-px w-8 bg-primary" aria-hidden="true" />
      <span className="text-muted-foreground">{children}</span>
    </p>
  );
}

export default async function LandingPage() {
  const [user, categories, latest, facets, postCounts, [employers]] = await Promise.all([
    getCurrentUser(),
    getActiveCategories(),
    listJobs({ pageSize: 9, prioritizeEarlyCareer: true }),
    getJobFacetCounts(),
    getCategoryPostCounts(),
    db.select({ value: countDistinct(jobs.companyName) }).from(jobs).where(openJobCondition()),
  ]);
  // Every figure below is read from the database for this request. Nothing is rounded up or estimated.
  const stats = [
    { label: "open roles", value: facets.total, href: "/jobs" },
    { label: "employers hiring", value: employers?.value ?? 0, href: "/jobs" },
    { label: "in India", value: facets.countries.IN ?? 0, href: "/cybersecurity-jobs/india" },
    { label: "in the US", value: facets.countries.US ?? 0, href: "/cybersecurity-jobs/usa" },
    { label: "remote", value: facets.remote, href: "/cybersecurity-jobs/remote" },
    { label: "internships & fresher", value: facets.earlyCareer, href: "/cybersecurity-jobs/entry-level" },
  ];

  return (
    <>
      <JsonLd data={[websiteLd(), platformOrganizationLd()]} />

      {/* Hero */}
      <section className="border-b">
        <div className={`${SHELL} grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-20`}>
          <div className="flex flex-col justify-center">
            <p className="label-mono text-primary">Built by the security community, for the security community</p>
            <h1 className="mt-5 text-balance text-[2.6rem] font-bold uppercase leading-[1.02] tracking-[0.01em] sm:text-6xl xl:text-7xl">
              Where cybersecurity professionals connect, build <span className="text-primary">&amp; get hired.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{APP_DESCRIPTION}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={user ? "/feed" : "/register"}>
                  {user ? "Go to your feed" : "Join the Community"} <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/jobs">Explore Cybersecurity Jobs</Link>
              </Button>
            </div>
            <p className="mt-6 font-mono text-xs text-subtle">free for professionals and students · no ads · no data sold</p>
          </div>

          {/* Live job board: real listings, straight from the database. */}
          <div className="flex min-w-0 flex-col border border-border-strong bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border-strong px-4 py-2.5">
              <p className="label-mono flex items-center gap-2 text-foreground">
                <span className="size-1.5 bg-primary" aria-hidden="true" /> Open roles · latest
              </p>
              <Link href="/jobs" className="label-mono inline-flex items-center gap-1 text-primary hover:underline">
                All {formatCount(facets.total)} <ArrowUpRight className="size-3" />
              </Link>
            </div>
            {latest.items.length > 0 ? (
              <ul className="divide-y">
                {latest.items.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.slug}`} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-4 py-2.5 transition-colors hover:bg-accent">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium group-hover:text-primary">{job.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {job.companyName} · {jobLocationLabel(job)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end justify-center gap-0.5 font-mono text-[11px] text-subtle">
                        <TimeAgo date={job.postedAt} />
                        <span className="uppercase">{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                The board is being synchronised. Open roles will appear here as soon as the first pass finishes.
              </p>
            )}
            <p className="mt-auto border-t px-4 py-2 font-mono text-[11px] text-subtle">source shown on every listing · closed roles are removed automatically</p>
          </div>
        </div>
      </section>

      {/* Live figures */}
      <section className="border-b bg-card" aria-label="Hiring board figures">
        <dl className={`${SHELL} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`}>
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href} className="group border-border px-1 py-5 sm:px-4 lg:border-l lg:first:border-l-0">
              <dd className="font-display text-3xl font-bold tabular-nums group-hover:text-primary">{formatCount(stat.value)}</dd>
              <dt className="label-mono mt-1 text-muted-foreground">{stat.label}</dt>
            </Link>
          ))}
        </dl>
      </section>

      {/* Domains */}
      <section className="border-b">
        <div className={`${SHELL} py-14 lg:py-20`}>
          <SectionLabel index="01">Domains</SectionLabel>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-bold uppercase leading-tight sm:text-4xl">Every corner of security has a place here</h2>
          <ul className="mt-8 grid border-l border-t sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category, index) => (
              <li key={category.slug} className="border-b border-r">
                <Link href={`/explore/${category.slug}`} className="group flex h-full items-baseline gap-3 px-4 py-3.5 transition-colors hover:bg-card">
                  <span className="font-mono text-[11px] text-subtle">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 font-display text-[15px] font-semibold uppercase tracking-[0.04em] group-hover:text-primary">{category.name}</span>
                  <span className="font-mono text-[11px] text-subtle">{formatCount(postCounts[category.slug] ?? 0)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How the board works */}
      <section className="border-b bg-card">
        <div className={`${SHELL} grid gap-10 py-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:py-20`}>
          <div>
            <SectionLabel index="02">Hiring board</SectionLabel>
            <h2 className="mt-4 text-balance text-3xl font-bold uppercase leading-tight sm:text-4xl">Current roles, with nobody asked to sign up first</h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Stale listings waste the time of the people who can least afford it. The board is kept current by reading employers’ own job boards, not by waiting for them to
              post here.
            </p>
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {JOB_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="inline-flex border px-2.5 py-1 font-mono text-[12px] text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <ol className="divide-y border-y">
            {BOARD_STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 py-5">
                <span className="font-display text-2xl font-bold text-primary">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[17px] font-semibold uppercase tracking-[0.03em]">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What is here */}
      <section className="border-b">
        <div className={`${SHELL} py-14 lg:py-20`}>
          <SectionLabel index="03">What is here</SectionLabel>
          <h2 className="mt-4 max-w-3xl text-balance text-3xl font-bold uppercase leading-tight sm:text-4xl">Made for how security people actually work</h2>
          <dl className="mt-8 grid gap-x-12 border-t md:grid-cols-2">
            {WHAT_IS_HERE.map((item) => (
              <Link key={item.label} href={item.href} className="group grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b py-4">
                <dt className="font-mono text-[13px] text-primary">./{item.label}</dt>
                <dd className="text-[14px] leading-relaxed text-muted-foreground group-hover:text-foreground">{item.body}</dd>
                <ArrowUpRight className="size-4 self-center text-subtle group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </dl>
        </div>
      </section>

      {/* Ground rules */}
      <section className="border-b bg-card">
        <div className={`${SHELL} py-14 lg:py-20`}>
          <SectionLabel index="04">Ground rules</SectionLabel>
          <h2 className="mt-4 text-balance text-3xl font-bold uppercase leading-tight sm:text-4xl">What you can hold us to</h2>
          <ol className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-5">
            {GROUND_RULES.map((rule, index) => (
              <li key={rule.title} className="border-t-2 border-primary pt-4">
                <span className="font-mono text-[11px] text-subtle">rule {index + 1}</span>
                <h3 className="mt-1 text-[16px] font-semibold uppercase tracking-[0.03em]">{rule.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{rule.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Employers and closing call */}
      <section>
        <div className={`${SHELL} grid gap-px bg-border py-px lg:grid-cols-2`}>
          <div className="bg-background py-12 lg:py-16 lg:pr-12">
            <p className="label-mono text-muted-foreground">For security teams that hire</p>
            <h2 className="mt-3 text-balance text-2xl font-bold uppercase leading-tight sm:text-3xl">Post roles and review applicants in one place</h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
              Register your organisation to post directly, track applicants and — once verified — search members who opted in to recruiter discovery. Your openings may
              already be listed from your public board; registering lets you manage them.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline">
                <Link href={user ? "/companies/new" : "/register?next=/companies/new"}>Register an organisation</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/companies">Browse organisations</Link>
              </Button>
            </div>
          </div>
          <div className="bg-background py-12 lg:py-16 lg:pl-12">
            <p className="label-mono text-muted-foreground">For everyone else</p>
            <h2 className="mt-3 text-balance text-2xl font-bold uppercase leading-tight sm:text-3xl">Build your security profile and find your next role</h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted-foreground">
              It takes a couple of minutes, it is free, and you can browse every job without an account.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={user ? "/feed" : "/register"}>
                  {user ? "Go to your feed" : "Join the Community"} <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/jobs">Explore Cybersecurity Jobs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
