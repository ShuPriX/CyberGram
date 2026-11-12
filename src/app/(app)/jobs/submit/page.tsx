import { Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { JobFormFields } from "@/components/jobs/job-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, CheckboxField, FormError, InputField, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { submitCommunityJobAction } from "@/server/actions/jobs";

export const metadata = privateMetadata("Submit a job");

export default async function SubmitJobPage() {
  await requireOnboardedUser();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Submit a job you found"
        description="Spotted a genuine cybersecurity opening on an employer's site? Share it with the community."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/recruiter">
              <Building2 /> Hiring for your own company?
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-foreground">Every submission is reviewed.</strong> A moderator opens the employer’s posting and confirms the role exists before it is
            published. It is labelled “Community-submitted”, links to the original, and is taken down when the role closes.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ActionForm action={submitCommunityJobAction} resetOnSuccess className="space-y-5">
            <FormError />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Company name" name="companyName" required maxLength={120} />
              <InputField label="Link to the employer's posting" name="applyUrl" type="url" required maxLength={2048} placeholder="https://company.com/careers/…" hint="Must be the employer's own careers page or ATS, not an aggregator." />
            </div>
            <JobFormFields />
            <CheckboxField
              label="I have checked that this role is real and currently open"
              name="confirm"
              required
              hint="I am not posting on behalf of the employer, and the listing does not ask candidates for any payment."
            />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton>Submit for review</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
