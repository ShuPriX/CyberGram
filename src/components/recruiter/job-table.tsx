import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { JOB_STATUS_LABELS, type JobStatus } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { CompanyJobRow } from "@/server/queries/hiring";

export const JOB_STATUS_TONE: Record<JobStatus, BadgeVariant> = {
  draft: "neutral",
  pending_review: "warning",
  active: "success",
  closed: "neutral",
  filled: "info",
  expired: "neutral",
  rejected: "danger",
};

export function RecruiterJobTable({ jobs, companyNames }: { jobs: (CompanyJobRow & { companyId: string })[]; companyNames?: Record<string, string> }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <EmptyState icon={BriefcaseBusiness} title="No listings yet" description="Post your first role — internships and entry-level roles are shown first to candidates." />
      </Card>
    );
  }
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Applicants</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Views</th>
            <th scope="col" className="px-4 py-2.5 font-medium">Posted</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {jobs.map((job) => (
            <tr key={job.id} className="transition-colors hover:bg-accent">
              <td className="px-4 py-3">
                <Link href={`/recruiter/jobs/${job.id}`} className="font-semibold hover:text-primary">
                  {job.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {[companyNames?.[job.companyId], job.location].filter(Boolean).join(" · ") || "—"}
                </p>
                {job.status === "pending_review" && job.reviewNote ? <p className="mt-0.5 text-xs text-warning">{job.reviewNote}</p> : null}
                {job.status === "rejected" && job.reviewNote ? <p className="mt-0.5 text-xs text-destructive">{job.reviewNote}</p> : null}
              </td>
              <td className="px-3 py-3">
                <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">
                {job.applicationCount}
                {job.newApplicants > 0 ? <Badge variant="primary" className="ml-1.5">{job.newApplicants} new</Badge> : null}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{job.viewCount}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(job.postedAt)}
                {job.status === "active" && job.expiresAt ? <span className="block text-xs text-subtle">Expires {formatDate(job.expiresAt, "short")}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
