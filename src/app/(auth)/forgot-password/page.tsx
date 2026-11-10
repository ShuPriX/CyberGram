import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { usesDevOutbox } from "@/lib/mail";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata("Reset your password");

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email address for your account and we will send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm devOutbox={usesDevOutbox} />
    </AuthCard>
  );
}
