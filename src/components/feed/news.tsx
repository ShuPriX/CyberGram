import { ArrowUpRight, Newspaper } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, TimeAgo } from "@/components/ui/misc";
import { NEWS_SOURCE_KIND_LABELS } from "@/lib/news/sources";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/server/queries/news";

const KIND_TONE: Record<NewsItem["sourceKind"], BadgeVariant> = { official: "primary", research: "info", press: "neutral" };

// Headlines link straight to the publisher. The destinations are a fixed list of vetted
// sources, and each stored link was checked to be on that source's own domain.
const SOURCE_LINK = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Full news stream: one entry per headline with its source, age and a short excerpt. */
export function NewsList({ items, className }: { items: NewsItem[]; className?: string }) {
  if (items.length === 0) {
    return (
      <Card className={className}>
        <EmptyState icon={Newspaper} title="The news desk is filling up" description="Headlines from the security agencies, research teams and press we follow appear here within half an hour." />
      </Card>
    );
  }
  return (
    <ol className={cn("divide-y border bg-card", className)}>
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.url} {...SOURCE_LINK} className="group block px-4 py-4 transition-colors hover:bg-accent sm:px-5">
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-subtle">
              <Badge variant={KIND_TONE[item.sourceKind]}>{NEWS_SOURCE_KIND_LABELS[item.sourceKind]}</Badge>
              <span className="uppercase tracking-[0.06em] text-muted-foreground">{item.sourceName}</span>
              <TimeAgo date={item.publishedAt} />
            </p>
            <h3 className="mt-2 text-[17px] font-semibold leading-snug group-hover:text-primary">
              {item.title} <ArrowUpRight className="mb-0.5 inline size-4 text-subtle group-hover:text-primary" aria-hidden="true" />
            </h3>
            {item.excerpt ? <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">{item.excerpt}</p> : null}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Compact headline block shown at the top of a member's feed and in side rails. */
export function NewsBrief({ items, href = "/feed?tab=news", className }: { items: NewsItem[]; href?: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="news-brief" className={cn("border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <h2 id="news-brief" className="label-mono flex items-center gap-2 text-foreground">
          <span className="size-1.5 bg-primary" aria-hidden="true" /> Security news
        </h2>
        <Link href={href} className="label-mono inline-flex items-center gap-1 text-primary hover:underline">
          All news <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <ol className="divide-y">
        {items.map((item) => (
          <li key={item.id}>
            <a href={item.url} {...SOURCE_LINK} className="group block px-4 py-2.5 transition-colors hover:bg-accent">
              <span className="block text-[14px] font-medium leading-snug group-hover:text-primary">{item.title}</span>
              <span className="mt-0.5 block font-mono text-[11px] text-subtle">
                {item.sourceName} · <TimeAgo date={item.publishedAt} />
              </span>
            </a>
          </li>
        ))}
      </ol>
      <p className="border-t px-4 py-2 font-mono text-[11px] text-subtle">from named agencies, research teams and security press · refreshed every 30 minutes</p>
    </section>
  );
}
