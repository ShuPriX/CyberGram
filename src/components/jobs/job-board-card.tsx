import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { TimeAgo } from "@/components/ui/misc";
import { EXPERIENCE_LEVEL_LABELS } from "@/lib/constants";
import { cn, formatCount } from "@/lib/utils";
import { getJobFacetCounts, listJobs } from "@/server/queries/jobs";
import { jobLocationLabel } from "./job-card";

/**
 * The live job board as a panel: the newest open roles, straight from the database, with the
 * total and a link to the full search. Shown on the home feed so jobs are never a page away.
 */
export async function JobBoardCard({ limit = 8, viewerId, className }: { limit?: number; viewerId?: string | null; className?: string }) {
  const [{ items }, facets] = await Promise.all([listJobs({ pageSize: limit, prioritizeEarlyCareer: true, viewerId }), getJobFacetCounts()]);
  return (
    <section aria-labelledby="job-board" className={cn("border border-border-strong bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border-strong px-4 py-2.5">
        <h2 id="job-board" className="label-mono flex items-center gap-2 text-foreground">
          <span className="size-1.5 bg-primary" aria-hidden="true" /> Open roles · latest
        </h2>
        <Link href="/jobs" className="label-mono inline-flex items-center gap-1 text-primary hover:underline">
          All {formatCount(facets.total)} <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y">
          {items.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.slug}`} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-2.5 transition-colors hover:bg-accent">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium group-hover:text-primary">{job.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {job.companyName} · {jobLocationLabel(job)}
                  </span>
                </span>
                <span className="flex flex-col items-end justify-center gap-0.5 font-mono text-[10.5px] text-subtle">
                  <TimeAgo date={job.postedAt} />
                  <span className="uppercase">{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">The board is being synchronised. Open roles will appear here shortly.</p>
      )}
      <nav aria-label="Job shortcuts" className="flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2.5 font-mono text-[11px]">
        <Link href="/cybersecurity-jobs/india" className="text-muted-foreground hover:text-primary">India {formatCount(facets.countries.IN ?? 0)}</Link>
        <Link href="/cybersecurity-jobs/usa" className="text-muted-foreground hover:text-primary">US {formatCount(facets.countries.US ?? 0)}</Link>
        <Link href="/cybersecurity-jobs/remote" className="text-muted-foreground hover:text-primary">Remote {formatCount(facets.remote)}</Link>
        <Link href="/cybersecurity-jobs/entry-level" className="text-muted-foreground hover:text-primary">Entry-level {formatCount(facets.earlyCareer)}</Link>
      </nav>
    </section>
  );
}
