import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, Notice } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { privateMetadata } from "@/lib/seo";
import { findAuthToken } from "@/server/services/accounts";

// The token is in the URL: keep it out of Referer headers sent to any other origin.
export const metadata: Metadata = { ...privateMetadata("Choose a new password"), referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = Boolean(await findAuthToken(token, "password_reset"));

  return (
    <AuthCard
      title="Choose a new password"
      description={valid ? "You will be signed out of every device once it is changed." : undefined}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <Notice tone="error">This reset link is invalid or has expired. Links work once and last 30 minutes.</Notice>
          <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </>
      )}
    </AuthCard>
  );
}
