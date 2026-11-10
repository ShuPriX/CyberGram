import { BadgeCheck, Banknote, Clock, Download, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TimeAgo } from "@/components/ui/misc";
import {
  countryName,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  WORK_ARRANGEMENT_LABELS,
  type JobSource,
} from "@/lib/constants";
import { cn, formatSalary } from "@/lib/utils";
import type { JobListItem } from "@/server/queries/jobs";

const SOURCE_META: Record<JobSource, { label: string; icon: typeof ShieldCheck }> = {
  direct: { label: "Posted by the company", icon: ShieldCheck },
  imported: { label: "Imported", icon: Download },
  community: { label: "Community-submitted", icon: Users },
};

/** Where a listing came from. Shown on every job so candidates can judge it. */
export function JobSourceLabel({ source, sourceName, className }: { source: JobSource; sourceName?: string | null; className?: string }) {
  const { label, icon: Icon } = SOURCE_META[source];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {source === "imported" && sourceName ? `Imported · ${sourceName}` : label}
    </span>
  );
}

export function jobLocationLabel(job: Pick<JobListItem, "location" | "country" | "workArrangement">): string {
  const place = job.location ?? countryName(job.country);
  const arrangement = WORK_ARRANGEMENT_LABELS[job.workArrangement];
  if (job.workArrangement === "remote") return place ? `Remote · ${place}` : "Remote";
  return place ? `${place} · ${arrangement}` : arrangement;
}

export function JobCard({ job, compact = false, action }: { job: JobListItem; compact?: boolean; action?: React.ReactNode }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  return (
    <article className="group relative rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-border-strong sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={job.companyName} fileId={job.company?.logoFileId} shape="square" size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug">
            <Link href={`/jobs/${job.slug}`} className="after:absolute after:inset-0 hover:text-primary">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
            <span className="truncate">{job.companyName}</span>
            {job.company?.verified ? <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label="Verified organisation" /> : null}
          </p>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1.5">
          {job.isDemo ? <Badge variant="warning">Demo</Badge> : null}
          {job.isNew ? <Badge variant="primary">New</Badge> : null}
          {job.viewer.applied ? <Badge variant="success">Applied</Badge> : null}
          {action}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {jobLocationLabel(job)}
        </span>
        {salary ? (
          <span className="inline-flex items-center gap-1">
            <Banknote className="size-3.5 shrink-0" aria-hidden="true" />
            {salary}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5 shrink-0" aria-hidden="true" />
          <TimeAgo date={job.postedAt} />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral">{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
        <Badge variant="neutral">{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</Badge>
        {!compact ? <JobSourceLabel source={job.source} sourceName={job.sourceName} className="ml-auto text-xs text-subtle" /> : null}
      </div>
    </article>
  );
}
