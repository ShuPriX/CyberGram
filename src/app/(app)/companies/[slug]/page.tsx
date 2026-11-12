import { AtSign, BadgeCheck, BriefcaseBusiness, Code, Globe, Link2, MapPin, Settings, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { SaveJobButton } from "@/components/jobs/job-actions";
import { JobCard } from "@/components/jobs/job-card";
import { PersonRow } from "@/components/people/person";
import { ReportButton } from "@/components/profile/profile-report";
import { DemoBanner, VerificationBadge } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { Markdown } from "@/components/shared/markdown";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { EmptyState, LinkTabs } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME, COMPANY_TYPE_LABELS, countryName } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { absoluteUrl, breadcrumbLd, pageMetadata } from "@/lib/seo";
import { displayHost, pluralize } from "@/lib/utils";
import { toggleCompanyFollowAction } from "@/server/actions/network";
import { getCompanyBySlug, getCompanyTeam } from "@/server/queries/companies";
import { listJobs } from "@/server/queries/jobs";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompanyBySlug((await params).slug, null);
  if (!company || company.status !== "active") return { title: "Organisation not found", robots: { index: false, follow: false } };
  return pageMetadata({
    title: `${company.name} — Cybersecurity Jobs and Company Profile`,
    description: company.tagline ?? company.description?.slice(0, 180) ?? `${company.name} on ${APP_NAME}: open cybersecurity roles, updates and team.`,
    path: `/companies/${company.slug}`,
    noindex: company.isDemo,
  });
}

const TABS = ["overview", "jobs", "posts", "people"] as const;
type Tab = (typeof TABS)[number];

export default async function CompanyPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const company = await getCompanyBySlug(slug, user?.id ?? null);
  if (!company) notFound();
  // A suspended page is only reachable by its own team (so they can see why) and by staff.
  const isStaff = user?.role === "admin" || user?.role === "super_admin";
  if (company.status !== "active" && !company.viewer.role && !isStaff) notFound();

  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : "overview";
  const path = `/companies/${company.slug}`;
  const viewer = user ? { id: user.id, role: user.role } : null;
  const [jobs, posts, team, categories] = await Promise.all([
    tab === "overview" || tab === "jobs" ? listJobs({ companyId: company.id, pageSize: tab === "jobs" ? 50 : 3, viewerId: user?.id }) : null,
    tab === "overview" || tab === "posts" ? getFeed({ viewer, companyId: company.id, limit: tab === "posts" ? 12 : 3 }) : null,
    tab === "people" ? getCompanyTeam(company.id) : [],
    getCategoryNames(),
  ]);
  const place = [company.hqLocation, countryName(company.hqCountry)].filter(Boolean).join(", ");
  const links = [
    company.website ? { href: company.website, icon: <Globe />, label: displayHost(company.website) } : null,
    company.linkedinUrl ? { href: company.linkedinUrl, icon: <Link2 />, label: "LinkedIn" } : null,
    company.twitterUrl ? { href: company.twitterUrl, icon: <AtSign />, label: "X / Twitter" } : null,
    company.githubUrl ? { href: company.githubUrl, icon: <Code />, label: "GitHub" } : null,
  ].filter((l) => l !== null);

  return (
    <div className="mx-auto max-w-[1040px] space-y-4">
      {!company.isDemo ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: company.name,
            description: company.tagline ?? undefined,
            url: company.website ?? absoluteUrl(path),
            logo: company.logoFileId ? absoluteUrl(`/api/files/${company.logoFileId}`) : undefined,
            address: place ? { "@type": "PostalAddress", addressLocality: company.hqLocation ?? undefined, addressCountry: company.hqCountry ?? undefined } : undefined,
            sameAs: [company.linkedinUrl, company.twitterUrl, company.githubUrl].filter(Boolean),
          }}
        />
      ) : null}
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Companies", path: "/companies" }, { name: company.name, path }])} />

      {company.isDemo ? <DemoBanner what="organisation" /> : null}
      {company.status !== "active" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-[13px] text-destructive-soft-foreground" role="status">
          This organisation page is suspended and hidden from the public.
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="aspect-[4/1] max-h-52 w-full bg-primary-soft">
          {company.coverFileId ? <img src={`/api/files/${company.coverFileId}`} alt="" className="size-full object-cover" /> : null}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-9 flex flex-wrap items-end justify-between gap-3">
            <Avatar name={company.name} fileId={company.logoFileId} shape="square" size="xl" className="border-4 border-card bg-card" />
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {company.viewer.role ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/recruiter/${company.slug}`}>
                    <Settings /> Manage
                  </Link>
                </Button>
              ) : null}
              {user ? (
                <ActionButton action={toggleCompanyFollowAction} input={{ companyId: company.id }} variant={company.viewer.following ? "outline" : "default"} size="sm" aria-pressed={company.viewer.following}>
                  {company.viewer.following ? "Following" : "Follow"}
                </ActionButton>
              ) : (
                <Button asChild size="sm">
                  <Link href={`/login?next=${encodeURIComponent(path)}`}>Follow</Link>
                </Button>
              )}
              {user ? <ReportButton targetType="company" targetId={company.id} label="Report this organisation" /> : null}
            </div>
          </div>
          <h1 className="mt-3 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            {company.name}
            {company.verified ? <BadgeCheck className="size-5 text-primary" aria-label="Verified organisation" /> : null}
          </h1>
          {company.tagline ? <p className="mt-1 text-[14.5px] leading-snug">{company.tagline}</p> : null}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            <span>{COMPANY_TYPE_LABELS[company.type]}</span>
            {place ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" /> {place}
              </span>
            ) : null}
            {company.size ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" aria-hidden="true" /> {company.size} employees
              </span>
            ) : null}
            <span>{pluralize(company.followerCount, "follower")}</span>
            <span className="inline-flex items-center gap-1.5">
              <BriefcaseBusiness className="size-4" aria-hidden="true" /> {pluralize(company.openJobs, "open role")}
            </span>
          </div>
          <div className="mt-3">
            <VerificationBadge status={company.verificationStatus === "verified" ? "verified" : "unverified"} />
            {!company.verified ? <span className="ml-2 text-xs text-subtle">This page has not been verified by CyberGram.</span> : null}
          </div>
        </div>
        <LinkTabs
          className="px-3"
          current={tab}
          items={[
            { value: "overview", label: "Overview", href: path },
            { value: "jobs", label: "Jobs", href: `${path}?tab=jobs`, count: company.openJobs },
            { value: "posts", label: "Posts", href: `${path}?tab=posts` },
            { value: "people", label: "People", href: `${path}?tab=people` },
          ]}
        />
      </Card>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <Section title="About">
              {company.description ? <Markdown>{company.description}</Markdown> : <p className="text-[13px] text-muted-foreground">This organisation has not added a description yet.</p>}
            </Section>
            {jobs && jobs.items.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[15px] font-semibold">Open roles</h2>
                  <Link href={`${path}?tab=jobs`} className="text-[13px] font-medium text-primary hover:underline">View all {jobs.total}</Link>
                </div>
                {jobs.items.map((job) => (
                  <JobCard key={job.id} job={job} compact />
                ))}
              </section>
            ) : null}
            {posts && posts.posts.length > 0 ? (
              <section className="space-y-3">
                <h2 className="px-1 text-[15px] font-semibold">Recent updates</h2>
                <FeedList initial={{ posts: posts.posts, nextCursor: null }} request={{ companyId: company.id }} context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories }} />
              </section>
            ) : null}
          </div>
          <aside className="space-y-4">
            {company.specializations.length > 0 ? (
              <Section title="Specialisations">
                <ul className="flex flex-wrap gap-1.5">
                  {company.specializations.map((s) => (
                    <li key={s}>
                      <Link href={`/explore/${s}`}>
                        <Badge variant="primary">{categories[s] ?? s}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {links.length > 0 ? (
              <Section title="Links">
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a href={leavingHref(link.href)} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary [&_svg]:size-4" {...EXTERNAL_LINK_PROPS}>
                        {link.icon} {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {company.locations.length > 0 ? (
              <Section title="Offices">
                <p className="text-[13px] text-muted-foreground">{company.locations.join(" · ")}</p>
              </Section>
            ) : null}
          </aside>
        </div>
      ) : null}

      {tab === "jobs" ? (
        jobs && jobs.items.length > 0 ? (
          <div className="space-y-3">
            {jobs.items.map((job) => (
              <JobCard key={job.id} job={job} action={<SaveJobButton jobId={job.id} saved={job.viewer.saved} signedIn={Boolean(user)} />} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={BriefcaseBusiness} title="No open roles right now" description={`Follow ${company.name} to hear when it posts a new role.`} />
          </Card>
        )
      ) : null}

      {tab === "posts" && posts ? (
        <div className="mx-auto max-w-2xl">
          <FeedList
            initial={posts}
            request={{ companyId: company.id }}
            context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories }}
            emptyTitle="No updates yet"
            emptyDescription="Announcements and hiring updates from this organisation will appear here."
          />
        </div>
      ) : null}

      {tab === "people" ? (
        <Section title="Hiring team" description="Members who manage this page and its listings.">
          {team.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No team members are listed.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {team.map((member) => (
                <li key={member.userId}>
                  <PersonRow person={{ id: member.userId, username: member.username, name: member.name, headline: member.title ?? member.headline, avatarFileId: member.avatarFileId, location: null }} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}
    </div>
  );
}
