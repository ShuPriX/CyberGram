import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { OAuthButtons, RegisterForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import { usesDevOutbox } from "@/lib/mail";
import { pageMetadata } from "@/lib/seo";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Join the cybersecurity community",
  description: `Create your free ${APP_NAME} profile: showcase certifications, CTF results and research, connect with security professionals, and find cybersecurity jobs in India, the USA and remote.`,
  path: "/register",
});

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next ? safeRedirectPath(params.next, "") : "";
  const user = await getCurrentUser();
  if (user) redirect(next || "/feed");

  return (
    <AuthCard
      title="Create your account"
      description="Free for security professionals and students."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons providers={env.oauth} next={next || undefined} />
      <RegisterForm devOutbox={usesDevOutbox} />
    </AuthCard>
  );
}
