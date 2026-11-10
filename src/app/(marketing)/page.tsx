import {
  ArrowRight,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  Globe,
  MapPin,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JobCard } from "@/components/jobs/job-card";
import { JsonLd } from "@/components/shared/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { pageMetadata, platformOrganizationLd, websiteLd } from "@/lib/seo";
import { getActiveCategories } from "@/server/queries/taxonomy";
import { listJobs } from "@/server/queries/jobs";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${APP_NAME} — The Professional Network for Cybersecurity`,
    description: APP_DESCRIPTION,
    path: "/",
  }),
  title: { absolute: `${APP_NAME} — The Professional Network for Cybersecurity` },
};

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: "Professional networking",
    body: "Connect with practitioners across red, blue and everything in between. Follow people for their work, not their job title.",
  },
  {
    icon: Award,
    title: "Achievements with evidence",
    body: "Certifications, CTF placements, CVEs, bounties and talks — each with an evidence link and a clear verification status.",
  },
  {
    icon: MessagesSquare,
    title: "Community discussions",
    body: "Topic-based communities for bug bounty, SOC, cloud, AppSec, AI security, DFIR, CTF and people just starting out.",
  },
  {
    icon: RefreshCw,
    title: "Fresh hiring opportunities",
    body: "Listings are re-checked against their source every day. Closed roles are removed, and every job shows where it came from.",
  },
  {
    icon: Building2,
    title: "Company recruitment",
    body: "Verified organisations publish roles, manage applicants and discover candidates by skill — within each member's privacy settings.",
  },
  {
    icon: Globe,
    title: "India and US opportunities",
    body: "Dedicated filters for India, the United States and remote roles, with internships and fresher openings surfaced first.",
  },
];

const JOB_LINKS = [
  { href: "/cybersecurity-jobs/india", label: "Cybersecurity jobs in India" },
  { href: "/cybersecurity-jobs/usa", label: "Cybersecurity jobs in the USA" },
  { href: "/cybersecurity-jobs/remote", label: "Remote cybersecurity jobs" },
  { href: "/cybersecurity-jobs/internships", label: "Cybersecurity internships" },
  { href: "/cybersecurity-jobs/entry-level", label: "Entry-level cybersecurity jobs" },
  { href: "/cybersecurity-jobs/soc-analyst", label: "SOC analyst jobs" },
  { href: "/cybersecurity-jobs/penetration-tester", label: "Penetration testing jobs" },
  { href: "/cybersecurity-jobs/cloud-security-engineer/india", label: "Cloud security jobs in India" },
];

const PRINCIPLES = [
  { title: "No fabricated listings", body: "Every job is posted by a company, imported from an authorised source, or submitted by a member and reviewed. Each one says which." },
  { title: "No pay-to-apply", body: "Listings that ask candidates for fees or deposits are flagged automatically and removed. Report anything that looks wrong." },
  { title: "Verification is earned", body: "Organisations and achievements are self-reported until a reviewer has checked the evidence. A badge always means someone looked." },
  { title: "Private by default", body: "You decide who sees your profile, whether recruiters can find you, and who may message you. Your data is never sold." },
];

/** Illustrative product preview. Decorative: it contains no real member or employer data. */
function HeroPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md select-none lg:max-w-none">
      <div className="rounded-2xl border bg-card p-5 shadow-pop">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full border bg-primary-soft text-sm font-semibold text-primary-soft-foreground">
            YN
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-tight">Your name</p>
            <p className="truncate text-[13px] text-muted-foreground">SOC Analyst · Detection Engineering</p>
          </div>
          <Badge variant="primary" className="ml-auto">Open to work</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["SIEM", "Threat Hunting", "MITRE ATT&CK", "Python", "Sigma Rules"].map((skill) => (
            <Badge key={skill} variant="neutral">{skill}</Badge>
          ))}
        </div>
        <div className="mt-5 space-y-2.5 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">Achievements</p>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <Award className="size-4 shrink-0 text-primary" />
              <span className="truncate">Certification with credential link</span>
            </span>
            <Badge variant="success"><BadgeCheck />Verified</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex min-w-0 items-center gap-2">
              <Award className="size-4 shrink-0 text-primary" />
              <span className="truncate">CTF finals placement</span>
            </span>
            <Badge variant="outline">Self-reported</Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border bg-card p-5 shadow-pop sm:ml-10 lg:-mr-4 lg:ml-16">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight">Security Analyst — Internship</p>
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
              Verified employer <BadgeCheck className="size-3.5 text-primary" />
            </p>
          </div>
          <Badge variant="primary">New</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />India · Hybrid</span>
          <span className="inline-flex items-center gap-1"><BriefcaseBusiness className="size-3.5" />Fresher</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" />Posted by the company</span>
        </div>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const [user, categories, latest] = await Promise.all([
    getCurrentUser(),
    getActiveCategories(),
    listJobs({ pageSize: 4, prioritizeEarlyCareer: true }),
  ]);

  return (
    <>
      <JsonLd data={[websiteLd(), platformOrganizationLd()]} />

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
          <div>
            <Badge variant="primary" className="mb-5">
              <ShieldCheck /> Built exclusively for cybersecurity
            </Badge>
            <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">{APP_TAGLINE}</h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-[17px]">{APP_DESCRIPTION}</p>
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
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
              {["Free for professionals and students", "Every listing shows its source", "Private by default"].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Domains */}
      <section className="border-b bg-card">
        <div className="mx-auto max-w-[1240px] px-4 py-10">
          <h2 className="text-[13px] font-medium text-muted-foreground">Every corner of security has a home</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/explore/${category.slug}`}
                  className="inline-flex rounded-full border bg-background px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-primary hover:text-primary"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">A network shaped around how security people actually work</h2>
          <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Not a general-purpose social network with a security filter. Profiles, achievements, communities and hiring are all designed
            for this field from the start.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-6">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                <Icon className="size-[18px]" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hiring */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-4 py-16 sm:py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">A hiring hub that stays current</h2>
            <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Stale and misleading listings waste the time of the people who can least afford it. Here, freshness and provenance are
              part of the product.
            </p>
            <ul className="mt-6 space-y-4">
              {[
                ["Clear provenance", "Each listing is labelled as posted by the company, imported from an external source, or community-submitted — with a link to the original."],
                ["Verified daily", "Imported roles are re-checked against their source every day. When a role closes there, it closes here."],
                ["Early careers first", "Internships, apprenticeships and fresher roles are surfaced first, not buried under senior listings."],
                ["Scam screening", "Listings that ask for payment or push candidates to off-platform chat are held for review before anyone sees them."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold">{title}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            {latest.items.length > 0 ? (
              <>
                <h3 className="text-[13px] font-medium text-muted-foreground">Recently added</h3>
                <ul className="mt-3 space-y-3">
                  {latest.items.map((job) => (
                    <li key={job.id}>
                      <JobCard job={job} compact />
                    </li>
                  ))}
                </ul>
                <Button asChild variant="link" className="mt-4">
                  <Link href="/jobs">
                    Browse all open roles <ArrowRight />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-[13px] font-medium text-muted-foreground">Browse by what you are looking for</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {JOB_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="group flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-[13px] font-medium transition-colors hover:border-primary"
                      >
                        {link.label}
                        <ArrowRight className="size-4 shrink-0 text-subtle transition-colors group-hover:text-primary" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Employers */}
      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:py-20">
        <div className="grid gap-8 rounded-2xl border bg-card p-8 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <Badge variant="neutral" className="mb-4">
              <Building2 /> For employers and recruiters
            </Badge>
            <h2 className="text-balance text-2xl font-semibold tracking-tight">Hire people for what they can demonstrably do</h2>
            <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Create a company page, publish roles to India, the US or remote candidates, manage applicants in one place, and search
              members who have opted in to recruiter discovery by skill, certification and specialisation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button asChild size="lg">
              <Link href={user ? "/companies/new" : "/register?next=/companies/new"}>Create a company page</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/companies">Browse companies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:py-20">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">What you can hold us to</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((item) => (
              <div key={item.title} className="border-l-2 border-primary pl-4">
                <h3 className="text-[15px] font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      {!user ? (
        <section className="border-t">
          <div className="mx-auto flex max-w-[1240px] flex-col items-center px-4 py-16 text-center sm:py-20">
            <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Build your security profile and find your next role
            </h2>
            <p className="mt-3 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
              It takes a couple of minutes to set up, and it is free for professionals and students.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Join the Community <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/jobs">Explore Cybersecurity Jobs</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
