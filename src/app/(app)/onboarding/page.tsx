import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ChipGroup, SkillDatalist } from "@/components/shared/fields";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, CheckboxField, FieldError, FormError, InputField, SelectField, SubmitButton } from "@/components/ui/form";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { APP_NAME, COUNTRIES, LIMITS, skillLabel } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { completeOnboardingAction } from "@/server/actions/profile";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Set up your profile");

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.onboarded) redirect("/feed");
  const [[profile], categories] = await Promise.all([db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1), getActiveCategories()]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Welcome to {APP_NAME}, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        A few details so your feed, job matches and suggestions are relevant from the start. You can change all of this later.
      </p>
      <Card className="mt-5">
        <CardContent>
          <ActionForm action={completeOnboardingAction} className="space-y-5">
            <FormError />
            <InputField
              label="Headline"
              name="headline"
              required
              maxLength={LIMITS.headline}
              defaultValue={profile?.headline ?? ""}
              placeholder="SOC Analyst · Detection engineering · Blue team"
              hint="One line that says what you do or what you are working towards."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Current role" name="currentTitle" optional maxLength={100} defaultValue={profile?.currentTitle ?? ""} placeholder="Security Analyst, Student…" />
              <InputField label="Company or institution" name="currentCompany" optional maxLength={100} defaultValue={profile?.currentCompany ?? ""} />
              <InputField label="City" name="location" optional maxLength={100} defaultValue={profile?.location ?? ""} placeholder="Bengaluru" />
              <SelectField label="Country" name="country" optional placeholder="Select a country" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={profile?.country ?? ""} />
              <InputField label="Years of experience" name="yearsExperience" type="number" min={0} max={60} optional defaultValue={profile?.yearsExperience ?? ""} hint="Use 0 if you are a student or just starting." />
            </div>
            <div>
              <ChipGroup
                legend="Which areas do you work in or want to follow?"
                name="domains"
                hint="Pick up to eight. These shape your feed and suggestions."
                options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                selected={profile?.domains ?? []}
              />
              <FieldError name="domains" className="mt-1.5" />
            </div>
            <InputField
              label="Skills"
              name="skills"
              optional
              list="skill-options"
              defaultValue={(profile?.skills ?? []).map(skillLabel).join(", ")}
              placeholder="Burp Suite, Splunk, Python, Active Directory"
              hint="Separate skills with commas."
            />
            <SkillDatalist />
            <CheckboxField
              label="I am open to work"
              name="openToWork"
              defaultChecked={profile?.openToWork ?? false}
              hint="Shown only to recruiters at verified companies unless you change it in your privacy settings."
            />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton size="lg">Continue to your feed</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
