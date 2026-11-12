import { eq } from "drizzle-orm";
import { Section } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { updateNotificationPrefsAction } from "@/server/actions/profile";

export const metadata = privateMetadata("Notification settings");

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const [profile] = await db.select({ prefs: profiles.notificationPrefs }).from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  const prefs = profile?.prefs ?? {};
  const groups = [...new Set(NOTIFICATION_TYPES.map((t) => t.group))];

  return (
    <>
      <PageHeader title="Notifications" description="Choose what reaches you in the app and by email." />
      <Section title="Preferences">
        <ActionForm action={updateNotificationPrefsAction} className="space-y-6">
          <FormError />
          {groups.map((group) => (
            <table key={group} className="w-full text-[13px]">
              <caption className="pb-2 text-left text-[13px] font-semibold uppercase tracking-wider text-subtle">{group}</caption>
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="pb-1.5 text-left font-medium">Notification</th>
                  <th scope="col" className="w-16 pb-1.5 text-center font-medium">In-app</th>
                  <th scope="col" className="w-16 pb-1.5 text-center font-medium">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y border-y">
                {NOTIFICATION_TYPES.filter((t) => t.group === group).map((type) => (
                  <tr key={type.value}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal">{type.label}</th>
                    <td className="text-center">
                      <Checkbox
                        name={`inApp:${type.value}`}
                        defaultChecked={prefs[type.value]?.inApp ?? true}
                        disabled={type.value === "system"}
                        aria-label={`${type.label}: in-app`}
                      />
                    </td>
                    <td className="text-center">
                      <Checkbox name={`email:${type.value}`} defaultChecked={prefs[type.value]?.email ?? type.emailDefault} aria-label={`${type.label}: email`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
          <p className="text-xs text-muted-foreground">Security emails — password changes and new sign-ins — are always sent.</p>
          <div className="flex justify-end border-t pt-4">
            <SubmitButton>Save preferences</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
