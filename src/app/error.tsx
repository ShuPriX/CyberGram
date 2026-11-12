"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary. Never shows internal details — only a reference for support. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-sm border bg-destructive-soft text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        The page could not be loaded. Your data is safe — try again, and contact us if it keeps happening.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-subtle">Reference: {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    </main>
  );
}
