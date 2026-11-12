import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { JobsNav } from "@/components/jobs/jobs-nav";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { APPLICATION_STATUS_META, JOB_STATUS_LABELS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { withdrawApplicationAction } from "@/server/actions/jobs";
import { listMyApplications } from "@/server/queries/hiring";

export const metadata = privateMetadata("My applications");

const WITHDRAWABLE = new Set(["submitted", "in_review", "shortlisted", "interview"]);

export default async function ApplicationsPage() {
  const user = await requireUser();
  const applications = await listMyApplications(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="My applications" description="Every application you made on CyberGram and where it stands. Applications made on an employer's own site are not tracked here." />
      <JobsNav current="applications" signedIn />
      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={BriefcaseBusiness}
            title="No applications yet"
            description="When you apply to a role posted directly on CyberGram, its status appears here."
            action={
              <Button asChild>
                <Link href="/jobs">Browse jobs</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        applications.map((application) => {
          const meta = APPLICATION_STATUS_META[application.status];
          return (
            <Card key={application.id}>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Avatar name={application.job.companyName} fileId={application.job.logoFileId} shape="square" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/jobs/${application.job.slug}`} className="text-[15px] font-semibold leading-snug hover:text-primary">
                      {application.job.title}
                    </Link>
                    <p className="text-[13px] text-muted-foreground">
                      {application.job.companyName} · Applied {formatDate(application.createdAt)}
                      {application.job.status !== "active" ? ` · Listing ${JOB_STATUS_LABELS[application.job.status].toLowerCase()}` : ""}
                    </p>
                  </div>
                  <Badge variant={meta.tone}>{meta.label}</Badge>
                </div>
                <ol className="flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                  {application.events.map((event, index) => (
                    <li key={index} className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      <span className="font-medium text-foreground">{APPLICATION_STATUS_META[event.status].label}</span>
                      {formatDate(event.createdAt, "short")}
                    </li>
                  ))}
                </ol>
                {WITHDRAWABLE.has(application.status) ? (
                  <div className="flex justify-end">
                    <ActionButton action={withdrawApplicationAction} input={{ id: application.id }} confirm="Withdraw this application? The employer will no longer see it." variant="ghost" size="xs" className="text-muted-foreground">
                      Withdraw application
                    </ActionButton>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
