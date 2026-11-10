import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, Notice } from "@/components/auth/auth-card";
import { ResendVerificationForm, VerifyEmailForm } from "@/components/auth/auth-forms";
import { privateMetadata } from "@/lib/seo";
import { findAuthToken } from "@/server/services/accounts";

export const metadata: Metadata = { ...privateMetadata("Confirm your email"), referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = Boolean(await findAuthToken(token, "email_verify"));

  return (
    <AuthCard
      title="Confirm your email"
      description={valid ? "One click and your account is active." : undefined}
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {valid ? (
        <VerifyEmailForm token={token} />
      ) : (
        <>
          <Notice tone="error">This confirmation link is invalid or has expired. Enter your email to get a new one.</Notice>
          <ResendVerificationForm />
        </>
      )}
    </AuthCard>
  );
}
