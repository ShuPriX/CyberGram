import { Check, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/jobs/job-card";
import { ResourceList } from "@/components/learn/resources";
import { SkillBadges } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { JOB_CATEGORIES } from "@/lib/constants";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { toggleRoadmapStepAction } from "@/server/actions/community";
import { getRoadmap, listResources } from "@/server/queries/community";
import { listJobs } from "@/server/queries/jobs";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const roadmap = await getRoadmap((await params).slug, null);
  if (!roadmap) return { title: "Roadmap not found" };
  return pageMetadata({ title: `${roadmap.title} — Cybersecurity Roadmap`, description: roadmap.description, path: `/learn/roadmaps/${roadmap.slug}` });
}

export default async function RoadmapPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const roadmap = await getRoadmap(slug, user?.id ?? null);
  if (!roadmap) notFound();
  const jobCategories = JOB_CATEGORIES.filter((c) => c.domain === roadmap.category).map((c) => c.slug);
  const [resources, categories, jobs] = await Promise.all([
    listResources({ category: roadmap.category, limit: 6 }, user?.id ?? null),
    getCategoryNames(),
    jobCategories.length > 0 ? listJobs({ categories: jobCategories, earlyCareerOnly: true, pageSize: 3, viewerId: user?.id }) : null,
  ]);
  const done = new Set(roadmap.completed);
  const path = `/learn/roadmaps/${roadmap.slug}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Learn", path: "/learn" }, { name: roadmap.title, path }])} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">Learn</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page">{roadmap.title}</span>
      </nav>
      <PageHeader title={roadmap.title} description={roadmap.description} action={<Badge variant="outline" className="capitalize">{roadmap.level}</Badge>} />

      {user ? (
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Your progress</span>
            <span>{done.size} of {roadmap.steps.length} stages</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={done.size} aria-valuemin={0} aria-valuemax={roadmap.steps.length} aria-label="Roadmap progress">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(done.size / Math.max(roadmap.steps.length, 1)) * 100}%` }} />
          </div>
        </div>
      ) : (
        <p className="rounded-lg border bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
          <Link href={`/login?next=${encodeURIComponent(path)}`} className="font-medium text-primary hover:underline">Sign in</Link> to track which stages you have completed.
        </p>
      )}

      <ol className="space-y-3">
        {roadmap.steps.map((step, index) => {
          const complete = done.has(index);
          return (
            <li key={step.title}>
              <Card className={cn(complete && "border-primary/40")}>
                <CardContent className="flex gap-4">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold",
                      complete ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {complete ? <Check className="size-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div>
                      <h2 className="text-[15px] font-semibold leading-snug">{step.title}</h2>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{step.summary}</p>
                    </div>
                    {step.outcomes.length > 0 ? (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">You should be able to</h3>
                        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[13px] leading-relaxed">
                          {step.outcomes.map((outcome) => (
                            <li key={outcome}>{outcome}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {step.skills?.length ? <SkillBadges skills={step.skills} /> : null}
                    {user ? (
                      <ActionButton action={toggleRoadmapStepAction} input={{ roadmapId: roadmap.id, step: index }} variant={complete ? "outline" : "soft"} size="xs">
                        {complete ? "Mark as not done" : "Mark as done"}
                      </ActionButton>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {resources.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Resources for this path</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/learn/resources?domain=${roadmap.category}`}>See all</Link>
            </Button>
          </div>
          <ResourceList resources={resources} categories={categories} signedIn={Boolean(user)} />
        </section>
      ) : null}

      {jobs && jobs.items.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Entry-level roles on this path</h2>
          {jobs.items.map((job) => (
            <JobCard key={job.id} job={job} compact />
          ))}
        </section>
      ) : null}
    </div>
  );
}
