import { eq, sql } from "drizzle-orm";
import { BadgeCheck, Banknote, CalendarClock, ChevronRight, Clock, ExternalLink, Info, MapPin, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApplyDialog, SaveJobButton } from "@/components/jobs/job-actions";
import { JobCard, jobLocationLabel, JobSourceLabel } from "@/components/jobs/job-card";
import { ReportButton } from "@/components/profile/profile-report";
import { DemoBanner, SkillBadges } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { Markdown } from "@/components/shared/markdown";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Section } from "@/components/ui/card";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import {
  APPLICATION_STATUS_META,
  countryName,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  JOB_CATEGORY_LABELS,
  JOB_SOURCE_LABELS,
  JOB_STATUS_LABELS,
  WORK_ARRANGEMENT_LABELS,
} from "@/lib/constants";
import { displayHost, formatDate, formatSalary, timeAgoLong } from "@/lib/utils";
import { leavingHref } from "@/lib/security/link-safety";
import { absoluteUrl, breadcrumbLd, markdownToBasicHtml, pageMetadata } from "@/lib/seo";
import { excerptOf } from "@/lib/text";
import { getCompanyAccess } from "@/server/services/access";
import { listResumes } from "@/server/queries/hiring";
import { getJobBySlug, getViewerJobState, listJobs } from "@/server/queries/jobs";

type Props = { params: Promise<{ slug: string }> };

const PUBLIC_STATUSES = new Set(["active", "closed", "filled", "expired"]);
const SCHEMA_EMPLOYMENT: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  internship: "INTERN",
  apprenticeship: "INTERN",
  contract: "CONTRACTOR",
  freelance: "CONTRACTOR",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const job = await getJobBySlug((await params).slug);
  if (!job || !PUBLIC_STATUSES.has(job.status)) return { title: "Job not found", robots: { index: false, follow: false } };
  const place = jobLocationLabel(job);
  return pageMetadata({
    title: `${job.title} at ${job.companyName} — ${place}`,
    description: excerptOf(job.description, 180),
    path: `/jobs/${job.slug}`,
    // Closed roles stay reachable for people with the link but leave the search index.
    noindex: !job.isOpen || job.isDemo,
  });
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);
  if (!job) notFound();
  const user = await getCurrentUser();

  // Drafts, listings in review and rejected listings are visible only to the hiring team and staff.
  const teamAccess = user && job.companyId ? await getCompanyAccess(user.id, { id: job.companyId }) : null;
  const isStaff = user?.role === "moderator" || user?.role === "admin" || user?.role === "super_admin";
  const isSubmitter = Boolean(user && job.postedById === user.id);
  if (!PUBLIC_STATUSES.has(job.status) && !teamAccess && !isStaff && !isSubmitter) notFound();

  const [state, resumes, similar] = await Promise.all([
    user ? getViewerJobState(job.id, user.id) : null,
    user && job.isOpen && job.applyMode === "platform" ? listResumes(user.id) : [],
    listJobs({ categories: [job.category], excludeId: job.id, pageSize: 3, viewerId: user?.id }),
  ]);
  if (job.isOpen && !teamAccess) await db.update(jobs).set({ viewCount: sql`${jobs.viewCount} + 1` }).where(eq(jobs.id, job.id));

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const application = state?.application && state.application.status !== "withdrawn" ? state.application : null;
  const path = `/jobs/${job.slug}`;

  // Structured data is only emitted while the role is open, so search engines never show a closed job.
  const jobPosting = job.isOpen && !job.isDemo
    ? {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        description: markdownToBasicHtml(job.description),
        datePosted: job.postedAt.toISOString(),
        validThrough: (job.deadline ?? job.expiresAt)?.toISOString(),
        employmentType: SCHEMA_EMPLOYMENT[job.employmentType],
        identifier: { "@type": "PropertyValue", name: job.companyName, value: job.id },
        hiringOrganization: {
          "@type": "Organization",
          name: job.companyName,
          ...(job.company?.website ? { sameAs: job.company.website } : {}),
          ...(job.company?.logoFileId ? { logo: absoluteUrl(`/api/files/${job.company.logoFileId}`) } : {}),
        },
        ...(job.workArrangement === "remote"
          ? { jobLocationType: "TELECOMMUTE", ...(job.country ? { applicantLocationRequirements: { "@type": "Country", name: countryName(job.country) } } : {}) }
          : {}),
        ...(job.location || job.country
          ? { jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location ?? undefined, addressCountry: job.country ?? undefined } } }
          : {}),
        ...(job.salaryMin || job.salaryMax
          ? {
              baseSalary: {
                "@type": "MonetaryAmount",
                currency: job.salaryCurrency ?? "USD",
                value: { "@type": "QuantitativeValue", minValue: job.salaryMin ?? undefined, maxValue: job.salaryMax ?? undefined, unitText: (job.salaryPeriod ?? "year").toUpperCase() },
              },
            }
          : {}),
        directApply: job.applyMode === "platform",
        url: absoluteUrl(path),
      }
    : null;

  return (
    <div className="space-y-5">
      {jobPosting ? <JsonLd data={jobPosting} /> : null}
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: job.title, path }])} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href={`/jobs?category=${job.category}`} className="hover:text-foreground">{JOB_CATEGORY_LABELS[job.category]}</Link>
      </nav>

      {job.isDemo ? <DemoBanner what="job listing" /> : null}
      {!job.isOpen ? (
        <p className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-soft px-3.5 py-3 text-[13px] text-warning" role="status">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">
              {job.status === "active" ? "This role is past its deadline" : `This listing is ${JOB_STATUS_LABELS[job.status].toLowerCase()}`}.
            </strong>{" "}
            {PUBLIC_STATUSES.has(job.status) ? "It is no longer accepting applications" : "It is not visible to candidates"}
            {job.closedReason ? ` (${job.closedReason.toLowerCase()})` : ""}.{job.reviewNote && (teamAccess || isStaff || isSubmitter) ? ` Note: ${job.reviewNote}.` : ""}
          </span>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-4">
                <Avatar name={job.companyName} fileId={job.company?.logoFileId} shape="square" size="lg" />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold leading-tight tracking-tight">{job.title}</h1>
                  <p className="mt-1 flex items-center gap-1 text-[14px]">
                    {job.company ? (
                      <Link href={`/companies/${job.company.slug}`} className="font-medium hover:text-primary hover:underline">{job.companyName}</Link>
                    ) : (
                      <span className="font-medium">{job.companyName}</span>
                    )}
                    {job.company?.verified ? <BadgeCheck className="size-4 text-primary" aria-label="Verified organisation" /> : null}
                  </p>
                </div>
                <ReportButton targetType="job" targetId={job.id} label="Report this listing" />
              </div>
              <dl className="grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Location</dt>
                  <dd>{jobLocationLabel(job)}{job.location && job.country ? `, ${countryName(job.country)}` : ""}</dd>
                </div>
                {salary ? (
                  <div className="flex items-center gap-2">
                    <Banknote className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Salary</dt>
                    <dd>{salary}</dd>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Posted</dt>
                  <dd>Posted {timeAgoLong(job.postedAt)}</dd>
                </div>
                {job.deadline ? (
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <dt className="sr-only">Deadline</dt>
                    <dd>Apply by {formatDate(job.deadline, "long")}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-wrap gap-1.5">
                <Badge>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
                <Badge>{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</Badge>
                <Badge>{WORK_ARRANGEMENT_LABELS[job.workArrangement]}</Badge>
                <Badge variant="primary">{JOB_CATEGORY_LABELS[job.category]}</Badge>
              </div>
            </CardContent>
          </Card>

          <Section title="About the role">
            <Markdown>{job.description}</Markdown>
          </Section>

          {job.skills.length > 0 || job.certifications.length > 0 ? (
            <Section title="Skills and certifications">
              <SkillBadges skills={job.skills} linkToJobs />
              {job.certifications.length > 0 ? (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">Certifications mentioned:</span> {job.certifications.join(", ")}
                </p>
              ) : null}
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-3">
              {teamAccess ? (
                <Button asChild size="lg" className="w-full">
                  <Link href={`/recruiter/jobs/${job.id}`}>Manage listing &amp; applicants</Link>
                </Button>
              ) : application ? (
                <div className="rounded-lg border bg-success-soft px-3.5 py-3 text-[13px] text-success">
                  <p className="font-semibold">You applied {timeAgoLong(application.createdAt)}</p>
                  <p className="mt-0.5">
                    Status: {APPLICATION_STATUS_META[application.status].label}.{" "}
                    <Link href="/jobs/applications" className="font-medium underline underline-offset-2">Track it</Link>
                  </p>
                </div>
              ) : !job.isOpen ? (
                <Button size="lg" className="w-full" disabled>
                  No longer accepting applications
                </Button>
              ) : job.applyMode === "external" && job.applyUrl ? (
                <>
                  <Button asChild size="lg" className="w-full">
                    <a href={leavingHref(job.applyUrl)} {...EXTERNAL_LINK_PROPS}>
                      Apply on {displayHost(job.applyUrl) ?? "the employer's site"} <ExternalLink />
                    </a>
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">You will leave CyberGram to apply. We show the destination before you go.</p>
                </>
              ) : user ? (
                <ApplyDialog jobId={job.id} jobTitle={job.title} companyName={job.companyName} resumes={resumes.map((r) => ({ id: r.id, label: r.label, isDefault: r.isDefault }))} />
              ) : (
                <Button asChild size="lg" className="w-full">
                  <Link href={`/login?next=${encodeURIComponent(path)}`}>Sign in to apply</Link>
                </Button>
              )}
              <SaveJobButton jobId={job.id} saved={state?.saved ?? false} signedIn={Boolean(user)} withLabel variant="outline" className="w-full" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 text-[13px]">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                <Info className="size-4 text-muted-foreground" aria-hidden="true" /> About this listing
              </h2>
              <p className="flex items-start gap-2">
                <JobSourceLabel source={job.source} sourceName={job.sourceName} className="font-medium" />
              </p>
              <p className="leading-relaxed text-muted-foreground">
                {job.source === "direct"
                  ? `${JOB_SOURCE_LABELS.direct} through its organisation page${job.company?.verified ? ", which our team has verified" : ". This organisation has not been verified yet"}.`
                  : job.source === "imported"
                    ? "Synchronised from the employer's own careers feed. Applications are made on the employer's site."
                    : "Shared by a community member and checked by a moderator against the employer's posting. Apply on the employer's site."}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="size-3.5 shrink-0" aria-hidden="true" /> Last confirmed open {timeAgoLong(job.lastVerifiedAt)}
              </p>
              {job.sourceUrl ? (
                <a href={leavingHref(job.sourceUrl)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline" {...EXTERNAL_LINK_PROPS}>
                  View original posting <ExternalLink className="size-3" />
                </a>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p>
                <strong className="font-semibold text-foreground">Stay safe.</strong> Genuine employers never ask for payment, deposits or training fees, and do not hire through chat apps
                alone. If something looks wrong, use the flag to report this listing.
              </p>
            </CardContent>
          </Card>

          {job.company ? (
            <Card>
              <CardContent className="space-y-2">
                <Link href={`/companies/${job.company.slug}`} className="group flex items-center gap-3">
                  <Avatar name={job.company.name} fileId={job.company.logoFileId} shape="square" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold group-hover:text-primary">{job.company.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[job.company.hqLocation, job.company.size ? `${job.company.size} employees` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
                {job.company.tagline ? <p className="text-[13px] leading-relaxed text-muted-foreground">{job.company.tagline}</p> : null}
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      {similar.items.length > 0 ? (
        <section aria-labelledby="similar" className="space-y-3">
          <h2 id="similar" className="text-[15px] font-semibold">Similar open roles</h2>
          <div className="grid gap-3 lg:grid-cols-3">
            {similar.items.map((item) => (
              <JobCard key={item.id} job={item} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
