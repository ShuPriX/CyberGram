import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, Notice } from "@/components/auth/auth-card";
import { LoginForm, OAuthButtons } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${APP_NAME}, the professional network for cybersecurity.`,
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true },
};

const OAUTH_ERRORS: Record<string, string> = {
  oauth_unavailable: "That sign-in method is not available.",
  oauth_denied: "Sign-in was cancelled.",
  oauth_state: "That sign-in attempt expired. Please try again.",
  oauth_failed: "We could not complete sign-in with that provider. Please try again.",
  oauth_email: "Your provider account has no verified email address, so it cannot be used to sign in.",
  account_unavailable: "This account is not available.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  const next = params.next ? safeRedirectPath(params.next, "") : "";
  const user = await getCurrentUser();
  if (user) redirect(next || (user.onboarded ? "/feed" : "/onboarding"));

  return (
    <AuthCard
      title="Welcome back"
      description={`Sign in to your ${APP_NAME} account.`}
      footer={
        <>
          New here?{" "}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {params.reset ? <Notice tone="success">Your password has been changed. Sign in with your new password.</Notice> : null}
      {params.error && OAUTH_ERRORS[params.error] ? <Notice tone="error">{OAUTH_ERRORS[params.error]}</Notice> : null}
      <OAuthButtons providers={env.oauth} next={next || undefined} />
      <LoginForm next={next || undefined} />
    </AuthCard>
  );
}
