import { ShieldCheck } from "lucide-react";
import { CompanyFormFields } from "@/components/companies/company-form-fields";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { createCompanyAction } from "@/server/actions/companies";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Add your organisation");

export default async function NewCompanyPage() {
  await requireOnboardedUser();
  const categories = await getActiveCategories();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title="Add your organisation" description="Create a page for your company or security team to publish roles, share updates and review applicants." />
      <Card>
        <CardContent className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-foreground">Only create a page for an organisation you represent.</strong> New pages are unverified. Until an administrator verifies
            yours, its job listings are reviewed before they go live. Impersonating an organisation leads to removal.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ActionForm action={createCompanyAction} className="space-y-5">
            <FormError />
            <CompanyFormFields categories={categories} />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton>Create organisation page</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
