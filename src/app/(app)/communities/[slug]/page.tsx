import { BadgeCheck, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { MiniFooter } from "@/components/layout/site-footer";
import { PageColumns } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Section } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { pluralize } from "@/lib/utils";
import { toggleCommunityMembershipAction } from "@/server/actions/community";
import { getCommunity } from "@/server/queries/community";
import { getFeed } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const community = await getCommunity((await params).slug, null);
  if (!community) return { title: "Community not found" };
  return pageMetadata({ title: `${community.name} Community`, description: community.description, path: `/communities/${community.slug}` });
}

const DEFAULT_RULES = [
  "Stay on topic and be constructive — critique work, not people.",
  "Only share findings you are authorised to disclose. No live targets, credentials or personal data.",
  "No malware, phishing kits or requests for unauthorised access.",
  "No job scams, paid-for placements or undisclosed promotion.",
];

export default async function CommunityPage({ params, searchParams }: Props) {
  const [{ slug }, { sort }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const community = await getCommunity(slug, user?.id ?? null);
  if (!community) notFound();
  const mode = sort === "trending" ? "trending" : "latest";
  const [initial, categories] = await Promise.all([getFeed({ viewer: user ? { id: user.id, role: user.role } : null, communityId: community.id, mode }), getActiveCategories()]);
  const path = `/communities/${community.slug}`;
  const rules = community.rules ? community.rules.split("\n").map((r) => r.trim()).filter(Boolean) : DEFAULT_RULES;

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Communities", path: "/communities" }, { name: community.name, path }])} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/communities" className="hover:text-foreground">Communities</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page">{community.name}</span>
      </nav>
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {community.name}
              {community.isOfficial ? <BadgeCheck className="size-5 text-primary" aria-label="Run by CyberGram" /> : null}
            </h1>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{community.description}</p>
            <p className="mt-2 text-xs text-subtle">
              {pluralize(community.memberCount, "member")} · {pluralize(community.postCount, "discussion")}
            </p>
          </div>
          {user ? (
            <ActionButton action={toggleCommunityMembershipAction} input={{ communityId: community.id }} variant={community.joined ? "outline" : "default"}>
              {community.joined ? "Leave community" : "Join community"}
            </ActionButton>
          ) : (
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(path)}`}>Join community</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <PageColumns
        aside={
          <>
            <Section title="Community rules">
              <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-muted-foreground">
                {rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ol>
            </Section>
            <MiniFooter />
          </>
        }
      >
        <LinkTabs
          current={mode}
          items={[
            { value: "latest", label: "Latest", href: path },
            { value: "trending", label: "Top", href: `${path}?sort=trending` },
          ]}
        />
        <FeedList
          key={`${mode}:${community.joined}`}
          initial={initial}
          request={{ communityId: community.id, mode }}
          context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories: Object.fromEntries(categories.map((c) => [c.slug, c.name])) }}
          composer={
            community.joined
              ? { categories, defaultCategory: community.category, community: { id: community.id, name: community.name }, placeholder: `Start a discussion in ${community.name}…` }
              : undefined
          }
          emptyTitle="No discussions yet"
          emptyDescription={community.joined ? "Start the first thread." : "Join the community to start the first thread."}
        />
      </PageColumns>
    </div>
  );
}
