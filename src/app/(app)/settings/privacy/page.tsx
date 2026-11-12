import { eq } from "drizzle-orm";
import { ChipGroup } from "@/components/shared/fields";
import { Section } from "@/components/ui/card";
import { ActionForm, CheckboxField, FormError, SelectField, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { MESSAGE_POLICIES, OPEN_TO_WORK_VISIBILITIES, PROFILE_VISIBILITIES } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { updatePrivacyAction } from "@/server/actions/profile";

export const metadata = privateMetadata("Privacy settings");

export default async function PrivacySettingsPage() {
  const user = await requireUser();
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (!profile) return null;

  return (
    <>
      <PageHeader title="Privacy" description="Decide who can see your profile, contact you and find you. Changes apply immediately." />
      <Section title="Visibility and contact">
        <ActionForm action={updatePrivacyAction} className="space-y-6">
          <FormError />
          <ChipGroup
            legend="Who can view your profile"
            name="visibility"
            type="radio"
            options={PROFILE_VISIBILITIES.map((v) => ({ value: v.value, label: v.label }))}
            selected={[profile.visibility]}
            hint="Public: anyone on the internet. Members only: signed-in members. Connections only: people you are connected with."
          />
          <CheckboxField
            label="Let search engines index my profile"
            name="indexable"
            defaultChecked={profile.indexable}
            hint="Only applies while your profile is public. Search engines can take time to drop pages they have already indexed."
          />
          <CheckboxField label="Show my email address to signed-in members" name="showEmail" defaultChecked={profile.showEmail} hint="Off by default. It is never shown to visitors who are not signed in." />
          <SelectField label="Who can start a conversation with you" name="messagePolicy" options={MESSAGE_POLICIES} defaultValue={profile.messagePolicy} className="max-w-sm" />

          <fieldset className="space-y-4 border-t pt-5">
            <legend className="sr-only">Recruiters</legend>
            <h3 className="text-[14px] font-semibold">Recruiters and hiring</h3>
            <CheckboxField label="I am open to work" name="openToWork" defaultChecked={profile.openToWork} />
            <SelectField
              label="Who can see that you are open to work"
              name="openToWorkVisibility"
              options={OPEN_TO_WORK_VISIBILITIES.map((o) => ({ value: o.value, label: `${o.label} — ${o.hint}` }))}
              defaultValue={profile.openToWorkVisibility}
              className="max-w-md"
            />
            <CheckboxField
              label="Include me in candidate discovery"
              name="recruiterDiscoverable"
              defaultChecked={profile.recruiterDiscoverable}
              hint="Opt in to appear when recruiters at verified organisations search for candidates. Your résumés are never shared this way — only with employers you apply to."
            />
          </fieldset>

          <div className="flex justify-end border-t pt-4">
            <SubmitButton>Save privacy settings</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
