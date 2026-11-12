import { Flag, LifeBuoy, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, InputField, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { contactAction } from "@/server/actions/community";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: `Contact the ${APP_NAME} team about support, partnerships, press, privacy requests or to report a problem.`,
  path: "/contact",
});

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "support", label: "Account or technical support" },
  { value: "report", label: "Report abuse or a security issue" },
  { value: "partnership", label: "Hiring partnership or job feed" },
  { value: "press", label: "Press" },
  { value: "privacy", label: "Privacy or data request" },
];

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">We read every message and reply to the email address you give us.</p>
        <ul className="mt-8 space-y-6 text-[13.5px] leading-relaxed">
          <li className="flex gap-3">
            <Flag className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Reporting content?</strong> The fastest route is the flag on the post, profile, job or company itself — it goes straight to the
              moderation queue with the context attached.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Found a vulnerability in {APP_NAME}?</strong> Choose “Report abuse or a security issue”. Please give us reasonable time to fix it
              before sharing details, and do not access other members’ data while testing.
            </span>
          </li>
          <li className="flex gap-3">
            <LifeBuoy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Privacy requests.</strong> You can close your account and delete your profile data yourself from{" "}
              <Link href="/settings" className="font-medium text-primary hover:underline">Settings</Link>. For anything else, see the{" "}
              <Link href="/privacy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </li>
        </ul>
      </div>
      <Card>
        <CardContent className="sm:p-7">
          <ActionForm action={contactAction} resetOnSuccess className="space-y-4">
            <FormError />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Your name" name="name" required maxLength={80} defaultValue={user?.name} autoComplete="name" />
              <InputField label="Email" name="email" type="email" required maxLength={254} defaultValue={user?.email} autoComplete="email" />
            </div>
            <SelectField label="Topic" name="topic" options={TOPICS} defaultValue="general" />
            <TextareaField label="Message" name="message" required rows={7} minLength={20} maxLength={4000} hint="Do not include passwords or other secrets." />
            {/* Honeypot: hidden from people, attractive to form-filling bots. */}
            <div className="hidden" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Send message</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
