import { Download, FileText, Lock, Trash2 } from "lucide-react";
import { JobsNav } from "@/components/jobs/jobs-nav";
import { DocumentUpload } from "@/components/shared/image-upload";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Section } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SubmitButton } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { LIMITS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatBytes, formatDate } from "@/lib/utils";
import { addResumeAction, deleteResumeAction, setDefaultResumeAction } from "@/server/actions/jobs";
import { listResumes } from "@/server/queries/hiring";

export const metadata = privateMetadata("Résumés");

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await listResumes(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Résumés" description={`Keep up to ${LIMITS.resumesPerUser} versions and choose one each time you apply.`} />
      <JobsNav current="resumes" signedIn />

      <Card>
        <CardContent className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-foreground">Résumés are private.</strong> A file is only readable by you and by the hiring team of a company you send it to with an
            application. It is never shown on your profile or in candidate discovery.
          </p>
        </CardContent>
      </Card>

      {resumes.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="No résumés uploaded" description="Upload a PDF or DOCX below to attach it to applications." />
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {resumes.map((resume) => (
                <li key={resume.id} className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                  <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className="truncate">{resume.label}</span>
                      {resume.isDefault ? <Badge variant="primary">Default</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {resume.fileName} · {formatBytes(resume.size)} · Added {formatDate(resume.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button asChild variant="outline" size="xs">
                      <a href={`/api/files/${resume.fileId}`} download>
                        <Download /> Download
                      </a>
                    </Button>
                    {!resume.isDefault ? (
                      <ActionButton action={setDefaultResumeAction} input={{ id: resume.id }} variant="ghost" size="xs">
                        Make default
                      </ActionButton>
                    ) : null}
                    <ActionButton action={deleteResumeAction} input={{ id: resume.id }} confirm="Remove this résumé?" variant="ghost" size="icon-sm" aria-label="Remove résumé" className="text-muted-foreground hover:text-destructive">
                      <Trash2 />
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {resumes.length < LIMITS.resumesPerUser ? (
        <Section title="Upload a résumé">
          <ActionForm action={addResumeAction} refresh resetOnSuccess className="space-y-4">
            <FormError />
            <InputField label="Label" name="label" required maxLength={80} placeholder="SOC analyst résumé — 2026" hint="Only you see this name." />
            <DocumentUpload name="fileId" />
            <div className="flex justify-end">
              <SubmitButton>Save résumé</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      ) : null}
    </div>
  );
}
