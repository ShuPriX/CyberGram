import { desc, eq } from "drizzle-orm";
import { BriefcaseBusiness, ExternalLink } from "lucide-react";
import Link from "next/link";
import { JobSourceLabel } from "@/components/jobs/job-card";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { companies, jobs, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { leavingHref } from "@/lib/security/link-safety";
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { displayHost, truncate } from "@/lib/utils";
import { reviewJobAction } from "@/server/actions/admin";

export const metadata = privateMetadata("Job review");

export default async function AdminJobsPage() {
  await requireCapability("moderate:jobs");
  const queue = await db
    .select({ job: jobs, verification: companies.verificationStatus, submitter: users.username })
    .from(jobs)
    .leftJoin(companies, eq(companies.id, jobs.companyId))
    .leftJoin(users, eq(users.id, jobs.postedById))
    .where(eq(jobs.status, "pending_review"))
    .orderBy(desc(jobs.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader
        title="Job review queue"
        description="Listings wait here when they come from an unverified organisation, a community submission, a source without auto-publish, or when they match a scam pattern. Open the original posting and confirm the role exists before approving."
      />
      {queue.length === 0 ? (
        <Card>
          <EmptyState icon={BriefcaseBusiness} title="The queue is clear" description="New listings that need a decision will appear here." />
        </Card>
      ) : (
        queue.map(({ job, verification, submitter }) => (
          <Card key={job.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-snug">
                    <Link href={`/jobs/${job.slug}`} className="hover:text-primary">{job.title}</Link>
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    {job.companyName}
                    {job.companyId ? ` · organisation ${verification === "verified" ? "verified" : "not verified"}` : ""} · {job.location ?? "No location"}
                  </p>
                </div>
                <TimeAgo date={job.createdAt} className="text-xs text-subtle" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline"><JobSourceLabel source={job.source} sourceName={job.sourceName} /></Badge>
                <Badge>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</Badge>
                <Badge>{EXPERIENCE_LEVEL_LABELS[job.experienceLevel]}</Badge>
                {submitter ? <Badge variant="outline">by @{submitter}</Badge> : null}
                {job.riskFlags.map((flag) => (
                  <Badge key={flag} variant="danger">{flag.replace(/_/g, " ")}</Badge>
                ))}
              </div>
              {job.reviewNote ? <p className="text-[13px] text-warning">{job.reviewNote}</p> : null}
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{truncate(job.description, 600)}</p>
              {job.applyUrl ?? job.sourceUrl ? (
                <Button asChild variant="outline" size="xs">
                  {/* Opens through the interstitial, which shows the real destination and any warning signs. */}
                  <a href={leavingHref((job.sourceUrl ?? job.applyUrl)!)} {...EXTERNAL_LINK_PROPS}>
                    <ExternalLink /> Open original on {displayHost((job.sourceUrl ?? job.applyUrl)!)}
                  </a>
                </Button>
              ) : null}
              <ActionForm action={reviewJobAction} refresh className="flex flex-wrap items-center gap-2 border-t pt-3">
                <input type="hidden" name="id" value={job.id} />
                <Input name="note" maxLength={500} placeholder="Reason (required to reject; sent to the submitter)" aria-label="Review note" className="min-w-52 flex-1" />
                <SubmitButton name="decision" value="reject" variant="destructive-ghost" size="sm">Reject</SubmitButton>
                <SubmitButton name="decision" value="approve" size="sm">Approve &amp; publish</SubmitButton>
                <FormError className="basis-full" />
              </ActionForm>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
