import { Mail } from "lucide-react";
import Link from "next/link";
import { MobileTabBar, SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/session";

/** Shell for every in-app and public content page: header, centred content, mobile tab bar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      {user && !user.emailVerified ? (
        <div className="border-b bg-warning-soft text-warning">
          <p className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 text-[13px]">
            <Mail className="size-4 shrink-0" aria-hidden="true" />
            Confirm your email address to apply for jobs, start conversations and create an organisation page.
            <Link href="/verify-email" className="font-semibold underline underline-offset-2">
              Resend the link
            </Link>
          </p>
        </div>
      ) : null}
      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 pb-24 md:pb-10">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
