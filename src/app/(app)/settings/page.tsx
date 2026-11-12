import { eq } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SubmitButton } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { deleteAccountAction } from "@/server/actions/profile";

export const metadata = privateMetadata("Account settings");

export default async function AccountSettingsPage() {
  const user = await requireUser();
  const [[account], providers] = await Promise.all([
    db.select({ createdAt: users.createdAt, hasPassword: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1),
    db.select({ provider: oauthAccounts.provider }).from(oauthAccounts).where(eq(oauthAccounts.userId, user.id)),
  ]);

  return (
    <>
      <PageHeader title="Account" description="Your sign-in identity. Your public details are edited on your profile." />
      <Section
        title="Account details"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/profile/edit">Edit profile</Link>
          </Button>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-[160px_1fr]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Handle</dt>
          <dd>@{user.username}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {user.email}
            {user.emailVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Not verified</Badge>}
            {!user.emailVerified ? (
              <Link href="/verify-email" className="text-primary hover:underline">
                Resend link
              </Link>
            ) : null}
          </dd>
          <dt className="text-muted-foreground">Account type</dt>
          <dd>{ROLE_LABELS[user.role]}</dd>
          <dt className="text-muted-foreground">Sign-in methods</dt>
          <dd>{[account?.hasPassword ? "Password" : null, ...providers.map((p) => (p.provider === "github" ? "GitHub" : "Google"))].filter(Boolean).join(", ") || "—"}</dd>
          <dt className="text-muted-foreground">Member since</dt>
          <dd>{account ? formatDate(account.createdAt, "long") : "—"}</dd>
        </dl>
      </Section>

      <Section title="Close account" description="Your profile, experience, achievements and sessions are deleted and your posts are hidden. This cannot be undone.">
        <ActionForm action={deleteAccountAction} className="max-w-sm space-y-4">
          <FormError />
          <InputField label={`Type your handle (${user.username}) to confirm`} name="confirm" required autoComplete="off" />
          {account?.hasPassword ? <InputField label="Password" name="password" type="password" required autoComplete="current-password" /> : null}
          <SubmitButton variant="destructive">Close my account</SubmitButton>
        </ActionForm>
      </Section>
    </>
  );
}
