import { ChipGroup } from "@/components/shared/fields";
import { InputField, SelectField, TextareaField } from "@/components/ui/form";
import type { companies } from "@/db/schema";
import { COMPANY_SIZES, COMPANY_TYPES, COUNTRIES } from "@/lib/constants";

type Company = typeof companies.$inferSelect;

export function CompanyFormFields({ company, categories }: { company?: Company; categories: { slug: string; name: string }[] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Organisation name" name="name" required maxLength={100} defaultValue={company?.name} hint={company ? "Renaming a verified organisation sends it back for review." : "Use the registered or trading name."} />
        <SelectField label="Type" name="type" required options={COMPANY_TYPES} defaultValue={company?.type ?? "startup"} />
      </div>
      <InputField label="Tagline" name="tagline" optional maxLength={160} defaultValue={company?.tagline ?? ""} placeholder="Managed detection and response for mid-market teams" />
      <TextareaField label="About" name="description" optional rows={7} maxLength={6000} defaultValue={company?.description ?? ""} hint="Markdown is supported. What you do, how your security team works and what it is like to work with you." />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Website" name="website" type="url" optional maxLength={2048} defaultValue={company?.website ?? ""} placeholder="https://example.com" hint="Required to request verification." />
        <SelectField label="Company size" name="size" optional placeholder="Not specified" options={COMPANY_SIZES.map((s) => ({ value: s, label: `${s} employees` }))} defaultValue={company?.size ?? ""} />
        <InputField label="Headquarters" name="hqLocation" optional maxLength={120} defaultValue={company?.hqLocation ?? ""} placeholder="Pune, Maharashtra" />
        <SelectField label="Country" name="hqCountry" optional placeholder="Select a country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={company?.hqCountry ?? ""} />
      </div>
      <InputField label="Other office locations" name="locations" optional defaultValue={company?.locations.join(", ") ?? ""} placeholder="Bengaluru, Austin, Remote" hint="Separate with commas." />
      <ChipGroup legend="Security specialisations" name="specializations" hint="Up to eight." options={categories.map((c) => ({ value: c.slug, label: c.name }))} selected={company?.specializations ?? []} />
      <div className="grid gap-4 sm:grid-cols-3">
        <InputField label="LinkedIn" name="linkedinUrl" type="url" optional maxLength={2048} defaultValue={company?.linkedinUrl ?? ""} />
        <InputField label="X / Twitter" name="twitterUrl" type="url" optional maxLength={2048} defaultValue={company?.twitterUrl ?? ""} />
        <InputField label="GitHub" name="githubUrl" type="url" optional maxLength={2048} defaultValue={company?.githubUrl ?? ""} />
      </div>
    </>
  );
}
