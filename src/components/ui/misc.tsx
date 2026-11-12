import { ChevronLeft, ChevronRight, LoaderCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { buttonVariants } from "./button";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn("size-4 animate-spin", className)} />;
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-border", className)} />;
}

/** Shown wherever a list has nothing in it yet — always says what to do next. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-sm border border-border-strong bg-muted text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Relative timestamp with the exact time available on hover and to assistive tech. */
export function TimeAgo({ date, className }: { date: Date | string; className?: string }) {
  const value = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={value.toISOString()} title={formatDate(value, "dateTime")} className={className} suppressHydrationWarning>
      {timeAgo(value)}
    </time>
  );
}

export type TabItem = { href: string; label: string; value: string; count?: number };

/** URL-driven tabs: each tab is a real link, so state survives reloads and is shareable. */
export function LinkTabs({ items, current, className }: { items: TabItem[]; current: string; className?: string }) {
  return (
    <nav className={cn("scrollbar-thin -mb-px flex gap-1 overflow-x-auto border-b", className)} aria-label="Sections">
      {items.map((item) => {
        const active = item.value === current;
        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            scroll={false}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 font-display text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span className={cn("rounded-sm px-1.5 font-mono text-[10.5px] leading-5", active ? "bg-primary-soft text-primary-soft-foreground" : "bg-secondary")}>
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pager({ prevHref, nextHref, className }: { prevHref?: string | null; nextHref?: string | null; className?: string }) {
  if (!prevHref && !nextHref) return null;
  return (
    <nav className={cn("flex items-center justify-between gap-3", className)} aria-label="Pagination">
      {prevHref ? (
        <Link href={prevHref} rel="prev" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ChevronLeft /> Previous
        </Link>
      ) : (
        <span />
      )}
      {nextHref ? (
        <Link href={nextHref} rel="next" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Next <ChevronRight />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold uppercase leading-tight tracking-[0.03em]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
