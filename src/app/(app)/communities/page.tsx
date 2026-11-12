import { BadgeCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { pluralize } from "@/lib/utils";
import { toggleCommunityMembershipAction } from "@/server/actions/community";
import { listCommunities } from "@/server/queries/community";
import { getCategoryNames } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Cybersecurity Communities and Discussion Groups",
  description: "Join topic-based cybersecurity communities for bug bounty, SOC, cloud security, application security, AI security, DFIR, CTF and beginners.",
  path: "/communities",
});

export default async function CommunitiesPage() {
  const user = await getCurrentUser();
  const [communities, categories] = await Promise.all([listCommunities(user?.id ?? null), getCategoryNames()]);
  const mine = communities.filter((c) => c.joined);
  const others = communities.filter((c) => !c.joined);

  const grid = (items: typeof communities) => (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((community) => (
        <li key={community.id}>
          <article className="group relative flex h-full flex-col rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-border-strong">
            <h3 className="flex items-center gap-1.5 text-[14.5px] font-semibold">
              <Link href={`/communities/${community.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">
                {community.name}
              </Link>
              {community.isOfficial ? <BadgeCheck className="size-4 text-primary" aria-label="Run by CyberGram" /> : null}
            </h3>
            <p className="text-xs text-subtle">{categories[community.category] ?? community.category}</p>
            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{community.description}</p>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3.5">
              <span className="text-xs text-muted-foreground">
                {pluralize(community.memberCount, "member")} · {pluralize(community.postCount, "discussion")}
              </span>
              <span className="relative z-10">
                {user ? (
                  <ActionButton action={toggleCommunityMembershipAction} input={{ communityId: community.id }} variant={community.joined ? "outline" : "soft"} size="xs">
                    {community.joined ? "Joined" : "Join"}
                  </ActionButton>
                ) : (
                  <Button asChild variant="soft" size="xs">
                    <Link href="/login?next=/communities">Join</Link>
                  </Button>
                )}
              </span>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Communities", path: "/communities" }])} />
      <PageHeader title="Communities" description="Topic-based spaces for focused discussion. Join one to start threads; anyone can read." />
      {communities.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title="No communities yet" description="Communities are created by the platform team. Check back soon." />
        </Card>
      ) : null}
      {mine.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Your communities</h2>
          {grid(mine)}
        </section>
      ) : null}
      {others.length > 0 ? (
        <section className="space-y-3">
          {mine.length > 0 ? <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Discover</h2> : null}
          {grid(others)}
        </section>
      ) : null}
    </div>
  );
}
