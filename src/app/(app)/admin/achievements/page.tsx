import { asc, eq } from "drizzle-orm";
import { Award, ExternalLink } from "lucide-react";
import Link from "next/link";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { achievements, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { ACHIEVEMENT_TYPE_META } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { displayHost, formatDate } from "@/lib/utils";
import { reviewAchievementAction } from "@/server/actions/admin";

export const metadata = privateMetadata("Achievement verification");

export default async function AdminAchievementsPage() {
  const reviewer = await requireCapability("verify:achievements");
  const queue = await db
    .select({ achievement: achievements, username: users.username, name: users.name })
    .from(achievements)
    .innerJoin(users, eq(users.id, achievements.userId))
    .where(eq(achievements.verificationStatus, "pending"))
    .orderBy(asc(achievements.verificationRequestedAt))
    .limit(100);

  return (
    <>
      <PageHeader
        title="Achievement verification"
        description="Open the evidence link and confirm it independently supports the claim — the right person, the right credential, the right date. If the evidence does not show it, decline with a reason. Never verify on trust."
      />
      {queue.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title="No requests waiting" description="Members' verification requests appear here in the order they were made." />
        </Card>
      ) : (
        queue.map(({ achievement, username, name }) => {
          const meta = ACHIEVEMENT_TYPE_META[achievement.type];
          const details = Object.entries(achievement.metadata).filter(([, v]) => v);
          return (
            <Card key={achievement.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold leading-snug">{achievement.title}</h2>
                    <p className="text-[13px] text-muted-foreground">
                      {meta.label}
                      {achievement.issuer ? ` · ${achievement.issuer}` : ""}
                      {achievement.achievedOn ? ` · ${formatDate(achievement.achievedOn)}` : ""} · claimed by{" "}
                      <Link href={`/u/${username}`} className="font-medium text-foreground hover:underline">{name}</Link> (@{username})
                    </p>
                  </div>
                  {achievement.verificationRequestedAt ? <TimeAgo date={achievement.verificationRequestedAt} className="text-xs text-subtle" /> : null}
                </div>
                {details.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {details.map(([key, value]) => (
                      <Badge key={key} variant="outline">{key}: {String(value)}</Badge>
                    ))}
                  </div>
                ) : null}
                {achievement.description ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{achievement.description}</p> : null}
                {achievement.evidenceUrl ? (
                  <Button asChild variant="outline" size="xs">
                    <a href={achievement.evidenceUrl} {...EXTERNAL_LINK_PROPS}>
                      <ExternalLink /> Open evidence on {displayHost(achievement.evidenceUrl)}
                    </a>
                  </Button>
                ) : null}
                {achievement.userId === reviewer.id ? (
                  <p className="border-t pt-3 text-[13px] text-muted-foreground">This is your own achievement. Another reviewer must decide it.</p>
                ) : (
                  <ActionForm action={reviewAchievementAction} refresh className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <input type="hidden" name="id" value={achievement.id} />
                    <Input name="note" maxLength={500} placeholder="Reason (required to decline; sent to the member)" aria-label="Decision note" className="min-w-52 flex-1" />
                    <SubmitButton name="decision" value="reject" variant="outline" size="sm">Decline</SubmitButton>
                    <SubmitButton name="decision" value="verify" size="sm">Verify</SubmitButton>
                    <FormError className="basis-full" />
                  </ActionForm>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
