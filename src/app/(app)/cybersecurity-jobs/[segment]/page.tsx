import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobBrowser, parseJobFilters } from "@/components/jobs/job-browser";
import type { RawParams } from "@/components/jobs/jobs-nav";
import { JsonLd } from "@/components/shared/json-ld";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { getJobLanding, JOB_LANDINGS } from "@/lib/job-landings";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { listJobs } from "@/server/queries/jobs";

type Props = { params: Promise<{ segment: string }>; searchParams: Promise<RawParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const landing = getJobLanding((await params).segment);
  if (!landing) return { title: "Not found" };
  const query = await searchParams;
  // An empty landing page is thin content: keep it out of the index until it has roles.
  const { total } = await listJobs({ ...landing.filters, pageSize: 1 });
  return pageMetadata({
    title: landing.title,
    description: landing.description,
    path: `/cybersecurity-jobs/${landing.slug}`,
    noindex: total === 0 || (parseJobFilters(query).page ?? 1) > 1,
  });
}

export default async function JobLandingPage({ params, searchParams }: Props) {
  const [{ segment }, query] = await Promise.all([params, searchParams]);
  const landing = getJobLanding(segment);
  if (!landing) notFound();
  const user = await getCurrentUser();
  const path = `/cybersecurity-jobs/${landing.slug}`;
  const related = JOB_LANDINGS.filter((l) => l.slug !== landing.slug && l.featured).slice(0, 9);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Jobs", path: "/jobs" }, { name: landing.heading, path }])} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/jobs" className="hover:text-foreground">Jobs</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page">{landing.short}</span>
      </nav>
      <PageHeader title={landing.heading} description={landing.description} />
      <JobBrowser params={query} basePath={path} fixed={landing.filters} viewerId={user?.id ?? null} heading={landing.short} />
      <nav aria-label="Related job searches" className="border-t pt-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Related searches</h2>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {related.map((item) => (
            <li key={item.slug}>
              <Link href={`/cybersecurity-jobs/${item.slug}`} className="inline-flex rounded-full border bg-card px-3 py-1 text-[13px] text-muted-foreground hover:border-border-strong hover:text-foreground">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
