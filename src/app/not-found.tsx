import { Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1760px] items-center px-4 sm:px-6 xl:px-10">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 pb-24 text-center">
        <div className="flex size-12 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
          <Compass className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-5 text-[13px] font-semibold uppercase tracking-wider text-primary">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          The page may have been removed, the link may be wrong, or you may not have access to it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/jobs">Browse jobs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/explore">Explore</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
