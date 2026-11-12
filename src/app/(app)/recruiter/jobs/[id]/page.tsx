import { and, eq } from "drizzle-orm";
import { ChevronRight, Download, ExternalLink, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageButton } from "@/components/people/person";
import { JOB_STATUS_TONE } from "@/components/recruiter/job-table";
import { SkillBadges } from "@/components/shared/fields";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { EmptyState, LinkTabs, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { APPLICATION_STATUS_META, APPLICATION_STATUSES, JOB_STATUS_LABELS, RECRUITER_APPLICATION_STATUSES } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { setJobStatusAction, updateApplicationAction } from "@/server/actions/jobs";
import { listApplicants } from "@/server/queries/hiring";
import { getCompanyAccess } from "@/server/services/access";

export const metadata = privateMetadata("Manage listing");

const SAVED_MESSAGES: Record<string, string> = {
  active: "Your listing is live and visible to candidates.",
  pending_review: "Your listing was saved and is waiting for a moderator's review before it goes live.",
  draft: "Draft saved. It is not visible to candidates until you publish it.",
};

export default async function ManageJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; saved?: string }> }) {
  const user = await requireOnboardedUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.source, "direct"))).limit(1);
  if (!job?.companyId) notFound();
  // Applicant data is only ever loaded after the caller's membership of the hiring company is confirmed.
  const access = await getCompanyAccess(user.id, { id: job.companyId });
  if (!access) notFound();

  const applicants = await listApplicants(job.id);
  const filter = APPLICATION_STATUSES.find((s) => s.value === query.status)?.value;
  const shown = filter ? applicants.filter((a) => a.status === filter) : applicants;
  const counts = new Map<string, number>();
  for (const applicant of applicants) counts.set(applicant.status, (counts.get(applicant.status) ?? 0) + 1);
  const base = `/recruiter/jobs/${job.id}`;
  const closed = ["closed", "filled", "expired"].includes(job.status);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/recruiter" className="hover:text-foreground">Recruiter portal</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href={`/recruiter/${access.company.slug}`} className="hover:text-foreground">{access.company.name}</Link>
      </nav>
      <PageHeader
        title={job.title}
        description={`${job.location ?? "No location"} · Posted ${formatDate(job.postedAt)}${job.expiresAt && job.status === "active" ? ` · Expires ${formatDate(job.expiresAt)}` : ""}`}
        action={
          <>
            <Badge variant={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/jobs/${job.slug}`}>
                <ExternalLink /> View
              </Link>
            </Button>
            {job.status !== "rejected" ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            ) : null}
            {closed ? (
              <ActionButton action={setJobStatusAction} input={{ id: job.id, status: "reopen" as const }} size="sm">
                Reopen
              </ActionButton>
            ) : job.status === "active" || job.status === "pending_review" || job.status === "draft" ? (
              <>
                <ActionButton action={setJobStatusAction} input={{ id: job.id, status: "filled" as const }} confirm="Mark this role as filled? It will be removed from search." variant="outline" size="sm">
                  Mark filled
                </ActionButton>
                <ActionButton action={setJobStatusAction} input={{ id: job.id, status: "closed" as const }} confirm="Close this listing? Candidates will no longer be able to apply." variant="destructive-ghost" size="sm">
                  Close
                </ActionButton>
              </>
            ) : null}
          </>
        }
      />

      {query.saved && SAVED_MESSAGES[query.saved] ? (
        <p className="rounded-lg border border-success/30 bg-success-soft px-3.5 py-3 text-[13px] text-success" role="status">{SAVED_MESSAGES[query.saved]}</p>
      ) : null}
      {job.reviewNote && (job.status === "pending_review" || job.status === "rejected") ? (
        <p className="rounded-lg border border-warning/40 bg-warning-soft px-3.5 py-3 text-[13px] text-warning" role="status">
          <strong className="font-semibold">{job.status === "rejected" ? "Not published" : "In review"}:</strong> {job.reviewNote}
        </p>
      ) : null}

      {job.applyMode === "external" ? (
        <Card>
          <EmptyState icon={Users} title="Applications are collected on your site" description="This listing sends candidates to your careers page, so there are no applicants to review here. Switch the application method to CyberGram to track them." />
        </Card>
      ) : (
        <>
          <LinkTabs
            current={filter ?? "all"}
            items={[
              { value: "all", label: "All", href: base, count: applicants.length },
              ...APPLICATION_STATUSES.filter((s) => s.value !== "withdrawn" && (counts.get(s.value) ?? 0) > 0).map((s) => ({
                value: s.value,
                label: s.label,
                href: `${base}?status=${s.value}`,
                count: counts.get(s.value),
              })),
            ]}
          />
          {shown.length === 0 ? (
            <Card>
              <EmptyState icon={Users} title={applicants.length === 0 ? "No applicants yet" : "No applicants at this stage"} description={applicants.length === 0 ? "Applications will appear here as candidates apply." : undefined} />
            </Card>
          ) : (
            shown.map((applicant) => {
              const meta = APPLICATION_STATUS_META[applicant.status];
              return (
                <Card key={applicant.id}>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <Link href={`/u/${applicant.candidate.username}`} className="shrink-0">
                        <Avatar name={applicant.candidate.name} fileId={applicant.candidate.avatarFileId} size="lg" />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <Link href={`/u/${applicant.candidate.username}`} className="text-[15px] font-semibold hover:underline">{applicant.candidate.name}</Link>
                          <Badge variant={meta.tone}>{meta.label}</Badge>
                        </p>
                        {applicant.candidate.headline ? <p className="text-[13px] text-muted-foreground">{applicant.candidate.headline}</p> : null}
                        <p className="mt-0.5 text-xs text-subtle">
                          {[
                            applicant.candidate.location,
                            applicant.candidate.yearsExperience !== null ? `${applicant.candidate.yearsExperience} yrs experience` : null,
                            `Applied ${formatDate(applicant.createdAt)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {applicant.resumeFileId ? (
                          <Button asChild variant="outline" size="sm">
                            <a href={`/api/files/${applicant.resumeFileId}`} download>
                              <Download /> Résumé
                            </a>
                          </Button>
                        ) : null}
                        <MessageButton userId={applicant.candidate.id} />
                      </div>
                    </div>
                    <SkillBadges skills={applicant.candidate.skills} max={10} />
                    {applicant.coverNote ? (
                      <blockquote className="whitespace-pre-line rounded-lg bg-muted px-3.5 py-3 text-[13.5px] leading-relaxed">{applicant.coverNote}</blockquote>
                    ) : null}
                    <ActionForm action={updateApplicationAction} refresh className="grid gap-3 border-t pt-4 sm:grid-cols-[200px_1fr_auto] sm:items-end">
                      <input type="hidden" name="id" value={applicant.id} />
                      <SelectField
                        label="Stage"
                        name="status"
                        options={[
                          ...(RECRUITER_APPLICATION_STATUSES.includes(applicant.status) ? [] : [{ value: "", label: meta.label }]),
                          ...RECRUITER_APPLICATION_STATUSES.map((s) => ({ value: s, label: APPLICATION_STATUS_META[s].label })),
                        ]}
                        defaultValue={RECRUITER_APPLICATION_STATUSES.includes(applicant.status) ? applicant.status : ""}
                        hint="The candidate is notified when this changes."
                      />
                      <TextareaField label="Private note" name="recruiterNote" optional rows={1} maxLength={2000} defaultValue={applicant.recruiterNote ?? ""} hint="Visible to your hiring team only." className="[&_textarea]:min-h-9" />
                      <SubmitButton variant="outline" className="sm:mb-[22px]">Update</SubmitButton>
                      <FormError className="sm:col-span-3" />
                    </ActionForm>
                  </CardContent>
                </Card>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
