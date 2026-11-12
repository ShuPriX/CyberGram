import { ArrowLeft, ExternalLink, ShieldAlert, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { assessLink } from "@/lib/security/link-safety";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Leaving CyberGram", robots: { index: false, follow: false } };

/**
 * Interstitial for every external link in member content. It shows the real destination,
 * explains any warning signs, and only then offers the link — with no referrer and no opener.
 */
export default async function LeavingPage({ searchParams }: { searchParams: Promise<{ url?: string | string[] }> }) {
  const raw = (await searchParams).url;
  const assessment = typeof raw === "string" && raw.length <= 2048 ? assessLink(raw) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1760px] items-center px-4 sm:px-6 xl:px-10">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 sm:p-8">
          {!assessment ? (
            <>
              <h1 className="text-lg font-semibold">This link cannot be opened</h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">It is not a valid web address. Only http and https links are allowed.</p>
              <div className="mt-6">
                <BackButton />
              </div>
            </>
          ) : (
            <>
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-sm",
                  assessment.level === "danger" ? "bg-destructive-soft text-destructive" : assessment.level === "caution" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary",
                )}
              >
                {assessment.level === "danger" ? <ShieldAlert className="size-5" /> : assessment.level === "caution" ? <TriangleAlert className="size-5" /> : <ExternalLink className="size-5" />}
              </div>
              <h1 className="mt-4 text-lg font-semibold">
                {assessment.level === "danger" ? "This link looks dangerous" : assessment.level === "caution" ? "Check this link before you continue" : `You are leaving ${APP_NAME}`}
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                This link was shared by a member and leads to a site we do not control. Never enter your {APP_NAME} password anywhere else.
              </p>
              <dl className="mt-5 space-y-3 rounded-lg border bg-muted p-4 text-[13px]">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-subtle">Destination</dt>
                  <dd className="mt-0.5 text-base font-semibold [overflow-wrap:anywhere]">{assessment.host}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-subtle">Full address</dt>
                  <dd className="mt-0.5 font-mono text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{assessment.url}</dd>
                </div>
              </dl>
              {assessment.reasons.length > 0 ? (
                <ul className={cn("mt-4 list-disc space-y-1 pl-5 text-[13px] leading-relaxed", assessment.level === "danger" ? "text-destructive" : "text-warning")}>
                  {assessment.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <BackButton primary={assessment.level !== "ok"} />
                <Button asChild variant={assessment.level === "ok" ? "default" : assessment.level === "danger" ? "destructive-ghost" : "outline"}>
                  <a href={assessment.url} rel="nofollow noopener noreferrer" referrerPolicy="no-referrer">
                    {assessment.level === "danger" ? "Continue anyway" : "Continue"} <ExternalLink />
                  </a>
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-subtle">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to {APP_NAME}
        </Link>
      </footer>
    </div>
  );
}
