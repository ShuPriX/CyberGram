"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionForm, CheckboxField, FormError, InputField, SubmitButton, useFormContext } from "@/components/ui/form";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailAction,
} from "@/server/actions/auth";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export type OAuthAvailability = { github: boolean; google: boolean };

/** Plain links (not form posts) so the redirect to the provider is not subject to form-action CSP. */
export function OAuthButtons({ providers, next }: { providers: OAuthAvailability; next?: string }) {
  if (!providers.github && !providers.google) return null;
  const query = next ? `?next=${encodeURIComponent(next)}` : "";
  const className =
    "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-card text-sm font-medium transition-colors hover:bg-accent";
  return (
    <div className="space-y-2.5">
      {providers.google ? (
        <a href={`/api/auth/google${query}`} className={className}>
          <GoogleIcon /> Continue with Google
        </a>
      ) : null}
      {providers.github ? (
        <a href={`/api/auth/github${query}`} className={className}>
          <GitHubIcon /> Continue with GitHub
        </a>
      ) : null}
      <div className="flex items-center gap-3 py-1 text-xs text-subtle" role="separator">
        <span className="h-px flex-1 bg-border" /> or continue with email <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <FormError />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <InputField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      <InputField label="Password" name="password" type="password" autoComplete="current-password" required />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
          Forgot your password?
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>
    </ActionForm>
  );
}

function SentPanel({ title, body, devOutbox }: { title: string; body: string; devOutbox: boolean }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-sm bg-primary-soft text-primary-soft-foreground">
        <MailCheck className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      {devOutbox ? (
        <p className="mt-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          Development mode: email is not being delivered.{" "}
          <Link href="/dev/outbox" className="font-medium text-primary hover:underline">
            Open the local outbox
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function RegisterFields({ devOutbox }: { devOutbox: boolean }) {
  const { state } = useFormContext();
  // Captured once per mount; lets the server discard submissions made faster than a human can type.
  const [renderedAt] = useState(() => Date.now());
  if (state?.ok) {
    return (
      <SentPanel
        title="Check your inbox"
        body="If this address can be registered, we have sent a link to confirm it. The link expires in 24 hours."
        devOutbox={devOutbox}
      />
    );
  }
  return (
    <div className="space-y-4">
      <FormError />
      <InputField label="Full name" name="name" autoComplete="name" required autoFocus maxLength={80} />
      <InputField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required />
      <InputField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters. A long passphrase is stronger than a short complex password."
      />
      {/* Honeypot: hidden from people and assistive technology, tempting to form-filling bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="renderedAt" value={renderedAt} />
      <CheckboxField
        name="terms"
        required
        label="I agree to the Terms of Service and Privacy Policy"
        hint={
          <>
            Read the{" "}
            <Link href="/terms" className="text-primary hover:underline" target="_blank">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline" target="_blank">
              Privacy Policy
            </Link>
            .
          </>
        }
      />
      <SubmitButton className="w-full" size="lg">
        Create account
      </SubmitButton>
    </div>
  );
}

export function RegisterForm({ devOutbox }: { devOutbox: boolean }) {
  return (
    <ActionForm action={registerAction} className="relative">
      <RegisterFields devOutbox={devOutbox} />
    </ActionForm>
  );
}

function ForgotFields({ devOutbox }: { devOutbox: boolean }) {
  const { state } = useFormContext();
  if (state?.ok) {
    return (
      <SentPanel
        title="Check your inbox"
        body="If an account exists for that address, a reset link is on its way. It expires in 30 minutes and can be used once."
        devOutbox={devOutbox}
      />
    );
  }
  return (
    <div className="space-y-4">
      <FormError />
      <InputField label="Email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      <SubmitButton className="w-full" size="lg">
        Send reset link
      </SubmitButton>
    </div>
  );
}

export function ForgotPasswordForm({ devOutbox }: { devOutbox: boolean }) {
  return (
    <ActionForm action={forgotPasswordAction}>
      <ForgotFields devOutbox={devOutbox} />
    </ActionForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      <FormError />
      <input type="hidden" name="token" value={token} />
      <InputField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        autoFocus
        hint="At least 10 characters."
      />
      <InputField label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <SubmitButton className="w-full" size="lg">
        Set new password
      </SubmitButton>
    </ActionForm>
  );
}

/** Confirmation is a deliberate click, so mail scanners that pre-fetch links cannot consume the token. */
export function VerifyEmailForm({ token }: { token: string }) {
  return (
    <ActionForm action={verifyEmailAction} className="space-y-4">
      <FormError />
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" size="lg">
        Confirm my email
      </SubmitButton>
    </ActionForm>
  );
}

export function ResendVerificationForm() {
  return (
    <ActionForm action={resendVerificationAction} className="space-y-3">
      <FormError />
      <InputField label="Email" name="email" type="email" autoComplete="email" required />
      <SubmitButton variant="outline" className="w-full">
        Send a new confirmation link
      </SubmitButton>
    </ActionForm>
  );
}
