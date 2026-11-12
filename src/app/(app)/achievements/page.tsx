import { desc, eq } from "drizzle-orm";
import { Award, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AchievementFields, AchievementItem } from "@/components/profile/achievements";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { achievements } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { ACHIEVEMENT_TYPES } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { deleteProfileItemAction, requestAchievementVerificationAction, saveAchievementAction } from "@/server/actions/profile";

export const metadata = privateMetadata("Achievements");

export default async function AchievementsPage() {
  const user = await requireOnboardedUser();
  const rows = await db.select().from(achievements).where(eq(achievements.userId, user.id)).orderBy(desc(achievements.featured), desc(achievements.achievedOn), desc(achievements.createdAt));
  const groups = ACHIEVEMENT_TYPES.map((type) => ({ type, items: rows.filter((a) => a.type === type.value) })).filter((g) => g.items.length > 0);
  const verified = rows.filter((a) => a.verificationStatus === "verified").length;

  const addButton = (
    <EntryDialog trigger={<><Plus /> Add achievement</>} variant="default" title="Add an achievement" description="It will be shown as self-reported until a moderator verifies it." action={saveAchievementAction} size="lg">
      <AchievementFields />
    </EntryDialog>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Achievements"
        description="Certifications, CTF placements, bug bounties, CVEs, publications and talks. Each entry shows whether it has been verified."
        action={addButton}
      />

      <Card>
        <CardContent className="flex items-start gap-3 text-[13px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            <strong className="font-semibold text-foreground">How verification works.</strong> Nothing is verified automatically. Add a public evidence link, request a review, and a
            moderator checks the claim against it. Editing a verified claim sends it back to self-reported.{" "}
            {rows.length > 0 ? `${verified} of your ${rows.length} achievements ${verified === 1 ? "is" : "are"} verified.` : ""}
          </p>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title="No achievements yet" description="Add your first certification, CTF result or disclosure. Evidence links make your profile credible." action={addButton} />
        </Card>
      ) : (
        groups.map(({ type, items }) => (
          <section key={type.value} aria-labelledby={`group-${type.value}`} className="space-y-2">
            <h2 id={`group-${type.value}`} className="px-1 text-[13px] font-semibold uppercase tracking-wider text-subtle">
              {type.plural}
            </h2>
            <Card>
              <CardContent>
                <ul className="divide-y">
                  {items.map((achievement) => (
                    <li key={achievement.id} className="py-4 first:pt-0 last:pb-0">
                      <AchievementItem
                        achievement={achievement}
                        actions={
                          <>
                            <EntryDialog trigger={<><Pencil /> Edit</>} variant="outline" buttonSize="xs" title="Edit achievement" action={saveAchievementAction} size="lg">
                              <AchievementFields achievement={achievement} />
                            </EntryDialog>
                            {achievement.verificationStatus === "unverified" || achievement.verificationStatus === "rejected" ? (
                              <ActionButton action={requestAchievementVerificationAction} input={{ id: achievement.id }} variant="soft" size="xs">
                                <ShieldCheck /> Request verification
                              </ActionButton>
                            ) : null}
                            <ActionButton action={deleteProfileItemAction} input={{ kind: "achievement" as const, id: achievement.id }} confirm="Remove this achievement?" variant="destructive-ghost" size="xs">
                              <Trash2 /> Remove
                            </ActionButton>
                            {achievement.verificationNote && achievement.verificationStatus !== "verified" ? (
                              <p className="basis-full text-xs text-muted-foreground">Reviewer note: {achievement.verificationNote}</p>
                            ) : null}
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
