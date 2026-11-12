import { ArrowRight, BookOpen, CalendarDays, Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EventList } from "@/components/learn/events";
import { ResourceList } from "@/components/learn/resources";
import { JsonLd } from "@/components/shared/json-ld";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { listResources, listRoadmaps, listUpcomingEvents } from "@/server/queries/community";
import { getCategoryNames } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Learn Cybersecurity — Roadmaps, Free Resources and Events",
  description: "Structured cybersecurity learning roadmaps, curated free labs and courses, and upcoming conferences, CTFs and training — for students and working professionals.",
  path: "/learn",
});

export default async function LearnPage() {
  const user = await getCurrentUser();
  const [roadmaps, resources, events, categories] = await Promise.all([
    listRoadmaps(user?.id ?? null),
    listResources({ limit: 6 }, user?.id ?? null),
    listUpcomingEvents({ limit: 4 }),
    getCategoryNames(),
  ]);

  return (
    <div className="space-y-8">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Learn", path: "/learn" }])} />
      <PageHeader title="Learning hub" description="Roadmaps to structure your learning, free resources recommended by practitioners, and events worth your time." />

      <section aria-labelledby="roadmaps" className="space-y-3">
        <h2 id="roadmaps" className="flex items-center gap-2 text-[15px] font-semibold">
          <MapIcon className="size-4 text-primary" aria-hidden="true" /> Career roadmaps
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roadmaps.map((roadmap) => {
            const done = roadmap.completed.length;
            const total = roadmap.steps.length;
            return (
              <li key={roadmap.id}>
                <Link href={`/learn/roadmaps/${roadmap.slug}`} className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-border-strong">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[14.5px] font-semibold group-hover:text-primary">{roadmap.title}</span>
                    <Badge variant="outline" className="capitalize">{roadmap.level}</Badge>
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{roadmap.description}</span>
                  <span className="mt-auto pt-3.5">
                    <span className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{total} stages</span>
                      {user && done > 0 ? <span>{done} of {total} done</span> : null}
                    </span>
                    {user && done > 0 ? (
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-sm bg-secondary" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Progress">
                        <span className="block h-full rounded-sm bg-primary" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="resources" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="resources" className="flex items-center gap-2 text-[15px] font-semibold">
            <BookOpen className="size-4 text-primary" aria-hidden="true" /> Top resources
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/learn/resources">
              Browse all <ArrowRight />
            </Link>
          </Button>
        </div>
        <ResourceList resources={resources} categories={categories} signedIn={Boolean(user)} />
      </section>

      <section aria-labelledby="events" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="events" className="flex items-center gap-2 text-[15px] font-semibold">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" /> Upcoming events
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">
              All events <ArrowRight />
            </Link>
          </Button>
        </div>
        <EventList events={events} />
      </section>
    </div>
  );
}
