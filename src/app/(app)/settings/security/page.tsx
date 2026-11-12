import { desc, eq } from "drizzle-orm";
import { Monitor } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { getSession, requireUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { formatDate, timeAgoLong } from "@/lib/utils";
import { and, like } from "drizzle-orm";
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from "@/server/actions/profile";

export const metadata = privateMetadata("Security settings");

/** A readable device label from the user-agent string. Display only — never used for decisions. */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const os = /Windows/.test(agent) ? "Windows" : /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac OS X/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "Unknown OS";
  return `${browser} on ${os}`;
}

export default async function SecuritySettingsPage() {
  const user = await requireUser();
  const current = await getSession();
  const [[account], sessionRows, activity] = await Promise.all([
    db.select({ hasPassword: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1),
    db.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.lastUsedAt)),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, ip: auditLogs.ip, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(and(eq(auditLogs.actorId, user.id), like(auditLogs.action, "auth.%")))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  return (
    <>
      <PageHeader title="Security" description="Your password, the devices signed in to your account and recent sign-in activity." />

      <Section title={account?.hasPassword ? "Change password" : "Set a password"} description="Passwords are stored as Argon2id hashes and checked against known breach data when you set them.">
        <ActionForm action={changePasswordAction} resetOnSuccess refresh className="max-w-sm space-y-4">
          <FormError />
          {account?.hasPassword ? <InputField label="Current password" name="currentPassword" type="password" required autoComplete="current-password" /> : null}
          <InputField label="New password" name="password" type="password" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} hint={`At least ${PASSWORD_MIN_LENGTH} characters. A long passphrase works best.`} />
          <InputField label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" />
          <SubmitButton>Update password</SubmitButton>
        </ActionForm>
      </Section>

      <Section
        title="Active sessions"
        description="Sign out anything you do not recognise, then change your password."
        action={
          sessionRows.length > 1 ? (
            <ActionButton action={revokeOtherSessionsAction} input={{}} confirm="Sign out of every other device?" variant="outline" size="sm">
              Sign out others
            </ActionButton>
          ) : undefined
        }
      >
        <ul className="divide-y">
          {sessionRows.map((session) => {
            const isCurrent = session.id === current?.sessionId;
            return (
              <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Monitor className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    {describeAgent(session.userAgent)}
                    {isCurrent ? <Badge variant="success">This device</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ip ?? "Unknown address"} · Active {timeAgoLong(session.lastUsedAt)} · Signed in {formatDate(session.createdAt)}
                  </p>
                </div>
                {!isCurrent ? (
                  <ActionButton action={revokeSessionAction} input={{ id: session.id.slice(0, 16) }} variant="outline" size="xs">
                    Sign out
                  </ActionButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Recent security activity">
        {activity.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="divide-y text-[13px]">
            {activity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 first:pt-0 last:pb-0">
                <span>{entry.action.replace(/^auth\./, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.ip ?? "—"} · {formatDate(entry.createdAt, "dateTime")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
