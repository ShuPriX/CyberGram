import type * as React from "react";

/** Shared frame for the long-form static pages (About, Privacy, Terms). */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {updated ? <p className="mt-2 text-[13px] text-subtle">Last updated {updated}</p> : null}
        {intro ? <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</p> : null}
      </header>
      <div className="prose mt-8">{children}</div>
    </article>
  );
}
