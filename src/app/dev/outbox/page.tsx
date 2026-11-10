import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { readDevOutbox, usesDevOutbox } from "@/lib/mail";
import { env } from "@/lib/env";
import { urlRegex } from "@/lib/text";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Development outbox", robots: { index: false, follow: false } };

/** Links back into this app are clickable; everything else stays inert text. */
function MailBody({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(urlRegex())) {
    const url = match[0];
    parts.push(text.slice(cursor, match.index));
    parts.push(
      url.startsWith(env.APP_URL) ? (
        <Link key={match.index} href={url.slice(env.APP_URL.length) || "/"} className="font-medium text-primary underline">
          {url}
        </Link>
      ) : (
        url
      ),
    );
    cursor = match.index + url.length;
  }
  parts.push(text.slice(cursor));
  return <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed">{parts}</pre>;
}

/**
 * Development-only view of captured email. It does not exist in production or whenever a real
 * SMTP transport is configured.
 */
export default async function DevOutboxPage() {
  if (!usesDevOutbox) notFound();
  const mails = await readDevOutbox();

  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-6 text-xl font-semibold tracking-tight">Development outbox</h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        No SMTP server is configured, so outgoing email is captured here instead of being delivered. Set <code>SMTP_URL</code> to send
        real mail.
      </p>
      <div className="mt-6 space-y-4">
        {mails.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-[13px] text-muted-foreground">Nothing has been sent yet.</p>
        ) : (
          mails.map((mail) => (
            <article key={mail.id} className="rounded-xl border bg-card p-5">
              <header className="mb-3 border-b pb-3">
                <h2 className="text-[14px] font-semibold">{mail.subject}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  To {mail.to} · {formatDate(mail.createdAt, "dateTime")}
                </p>
              </header>
              <MailBody text={mail.text} />
            </article>
          ))
        )}
      </div>
    </main>
  );
}
