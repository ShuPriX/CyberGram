import { Building2, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JobBrowser, parseJobFilters } from "@/components/jobs/job-browser";
import { JobsNav, type RawParams } from "@/components/jobs/jobs-nav";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { getJobFacetCounts } from "@/server/queries/jobs";
import { JOB_LANDINGS } from "@/lib/job-landings";

type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.keys(params).length > 0;
  const { page } = parseJobFilters(params);
  return pageMetadata({
    title: "Cybersecurity Jobs — SOC, Pentesting, Cloud Security and More",
    description:
      "Search current cybersecurity jobs in India, the United States and remote: SOC analyst, penetration tester, cloud security, AppSec, GRC, internships and fresher roles. Updated daily.",
    // Every filter and sort combination canonicalises to the clean listing page.
    path: "/jobs",
    noindex: filtered && (page ?? 1) > 1,
  });
}

export default async function JobsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [user, facets] = await Promise.all([getCurrentUser(), getJobFacetCounts()]);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }])} />
      <PageHeader
        title="Cybersecurity jobs"
        description={`${facets.total} open roles across security operations, offensive security, cloud, AppSec and GRC — ${facets.earlyCareer} for students and freshers, ${facets.remote} remote.`}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/jobs/submit">
                <PlusCircle /> Submit a job
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/recruiter">
                <Building2 /> Post as a company
              </Link>
            </Button>
          </>
        }
      />
      <nav aria-label="Popular searches" className="flex flex-wrap gap-1.5">
        {JOB_LANDINGS.filter((l) => l.featured).map((landing) => (
          <Link key={landing.slug} href={`/cybersecurity-jobs/${landing.slug}`} className="rounded-sm border bg-card px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
            {landing.short}
          </Link>
        ))}
      </nav>
      <JobsNav current="browse" signedIn={Boolean(user)} />
      <JobBrowser params={params} basePath="/jobs" viewerId={user?.id ?? null} />
    </div>
  );
}
