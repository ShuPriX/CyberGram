import { ExternalLink, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyFormFields } from "@/components/companies/company-form-fields";
import { PersonRow } from "@/components/people/person";
import { RecruiterJobTable } from "@/components/recruiter/job-table";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { VerificationBadge } from "@/components/shared/fields";
import { ImageUpload } from "@/components/shared/image-upload";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { addCompanyMemberAction, removeCompanyMemberAction, requestCompanyVerificationAction, updateCompanyAction } from "@/server/actions/companies";
import { getCompanyTeam } from "@/server/queries/companies";
import { listCompanyJobs } from "@/server/queries/hiring";
import { getActiveCategories } from "@/server/queries/taxonomy";
import { getCompanyAccess } from "@/server/services/access";

export const metadata = privateMetadata("Manage organisation");

export default async function ManageCompanyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireOnboardedUser();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // Membership is the only thing that grants access here; a non-member gets a 404.
  const access = await getCompanyAccess(user.id, { slug });
  if (!access) notFound();
  const { company, role } = access;
  const canManage = role !== "recruiter";
  const [team, jobs, categories] = await Promise.all([getCompanyTeam(company.id), listCompanyJobs([company.id]), getActiveCategories()]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title={company.name}
        description={`You are ${role === "owner" ? "an owner" : role === "admin" ? "an admin" : "a recruiter"} of this organisation.`}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/companies/${company.slug}`}>
                <ExternalLink /> View public page
              </Link>
            </Button>
            {company.status === "active" ? (
              <Button asChild size="sm">
                <Link href={`/recruiter/${company.slug}/jobs/new`}>
                  <Plus /> Post a job
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {query.created ? (
        <p className="rounded-lg border border-success/30 bg-success-soft px-3.5 py-3 text-[13px] text-success" role="status">
          Your organisation page is live. Add a logo and description, then request verification so your listings publish without review.
        </p>
      ) : null}
      {company.status !== "active" ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-[13px] text-destructive-soft-foreground" role="alert">
          This organisation has been suspended by an administrator. Its page is hidden and its listings are closed. Contact support if you believe this is a mistake.
        </p>
      ) : null}

      <Section title="Verification" description="Verification confirms this page is run by the organisation it names. It is decided by an administrator — never automatically.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={company.verificationStatus} />
            {company.verifiedAt ? <span className="text-xs text-muted-foreground">Verified {formatDate(company.verifiedAt)}</span> : null}
            {company.verificationStatus === "pending" && company.verificationRequestedAt ? (
              <span className="text-xs text-muted-foreground">Requested {formatDate(company.verificationRequestedAt)}</span>
            ) : null}
          </div>
          {company.verificationNote && company.verificationStatus !== "verified" ? <p className="text-[13px] text-muted-foreground">Reviewer note: {company.verificationNote}</p> : null}
          {canManage && (company.verificationStatus === "unverified" || company.verificationStatus === "rejected") ? (
            <EntryDialog
              trigger={<><ShieldCheck /> Request verification</>}
              variant="soft"
              title="Request verification"
              description="Tell us how to confirm you represent this organisation."
              action={requestCompanyVerificationAction}
              submitLabel="Send request"
            >
              <input type="hidden" name="companyId" value={company.id} />
              <TextareaField
                label="Evidence"
                name="evidence"
                required
                rows={5}
                minLength={30}
                maxLength={2000}
                placeholder="e.g. I am Head of Talent; my work email is on the company domain; our careers page at … links to this profile."
                hint="Do not include passwords or confidential documents. An administrator may contact you at your account email."
              />
            </EntryDialog>
          ) : null}
        </div>
      </Section>

      <section aria-labelledby="listings" className="space-y-3">
        <h2 id="listings" className="px-1 text-[15px] font-semibold">Listings</h2>
        <RecruiterJobTable jobs={jobs} />
      </section>

      <Section
        title="Team"
        description="Team members can post jobs and review applicants. Owners and admins can also edit this page and manage the team."
        action={
          canManage ? (
            <EntryDialog trigger={<><UserPlus /> Add member</>} title="Add a team member" action={addCompanyMemberAction} submitLabel="Add" size="sm">
              <input type="hidden" name="companyId" value={company.id} />
              <InputField label="Member's handle" name="username" required maxLength={30} placeholder="their-handle" hint="They must already have a CyberGram account." />
              <SelectField label="Role" name="role" options={[{ value: "recruiter", label: "Recruiter — jobs and applicants" }, { value: "admin", label: "Admin — also page and team" }]} defaultValue="recruiter" />
              <InputField label="Title" name="title" optional maxLength={80} placeholder="Talent Partner" />
            </EntryDialog>
          ) : undefined
        }
      >
        <ul className="divide-y">
          {team.map((member) => (
            <li key={member.userId} className="py-3.5 first:pt-0 last:pb-0">
              <PersonRow
                person={{ id: member.userId, username: member.username, name: member.name, headline: member.title ?? member.headline, avatarFileId: member.avatarFileId, location: null }}
                action={
                  <>
                    <Badge variant={member.role === "owner" ? "primary" : "neutral"} className="capitalize">{member.role}</Badge>
                    {member.userId === user.id || (canManage && member.role !== "owner") || role === "owner" ? (
                      <ActionButton
                        action={removeCompanyMemberAction}
                        input={{ companyId: company.id, userId: member.userId }}
                        confirm={member.userId === user.id ? "Leave this organisation?" : `Remove ${member.name} from the team?`}
                        redirectTo={member.userId === user.id ? "/recruiter" : undefined}
                        variant="ghost"
                        size="icon-sm"
                        aria-label={member.userId === user.id ? "Leave organisation" : "Remove member"}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </ActionButton>
                    ) : null}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      </Section>

      {canManage ? (
        <Section title="Organisation page">
          <ActionForm action={updateCompanyAction} refresh className="space-y-5">
            <FormError />
            <input type="hidden" name="companyId" value={company.id} />
            <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
              <ImageUpload name="logoFileId" kind="logo" label="Logo" initialFileId={company.logoFileId} />
              <ImageUpload name="coverFileId" kind="cover" label="Cover image" shape="wide" initialFileId={company.coverFileId} />
            </div>
            <CompanyFormFields company={company} categories={categories} />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
