import { JobFormFields } from "@/components/jobs/job-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SelectField, SubmitButton } from "@/components/ui/form";
import type { jobs } from "@/db/schema";
import { saveCompanyJobAction } from "@/server/actions/jobs";

/** Create/edit form for a direct listing. The action re-checks company membership on submit. */
export function CompanyJobForm({ company, job }: { company: { id: string; name: string; verified: boolean }; job?: typeof jobs.$inferSelect }) {
  return (
    <Card>
      <CardContent>
        <ActionForm action={saveCompanyJobAction} className="space-y-5">
          <FormError />
          <input type="hidden" name="companyId" value={company.id} />
          {job ? <input type="hidden" name="id" value={job.id} /> : null}
          <JobFormFields job={job} />
          <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
            <legend className="px-1 text-[13px] font-semibold">How candidates apply</legend>
            <SelectField
              label="Application method"
              name="applyMode"
              options={[
                { value: "platform", label: "On CyberGram (track applicants here)" },
                { value: "external", label: "On our careers site" },
              ]}
              defaultValue={job?.applyMode ?? "platform"}
            />
            <InputField label="Application link" name="applyUrl" type="url" optional maxLength={2048} defaultValue={job?.applyUrl ?? ""} placeholder="https://company.com/careers/role" hint="Only needed when candidates apply on your site." />
          </fieldset>
          {!company.verified ? (
            <p className="rounded-lg border bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
              {company.name} is not verified yet, so this listing will be reviewed by a moderator before it is shown to candidates. This usually takes less than a day.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button type="submit" name="intent" value="draft" variant="outline">
              Save as draft
            </Button>
            <SubmitButton name="intent" value="publish">
              {job && job.status === "active" ? "Save changes" : "Publish listing"}
            </SubmitButton>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
