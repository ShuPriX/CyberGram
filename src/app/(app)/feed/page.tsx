import { Award, Bookmark, BriefcaseBusiness, Building2, FileText, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { FeedList } from "@/components/feed/feed-list";
import { LatestJobsCard, SuggestedPeopleCard, TrendingTagsCard } from "@/components/feed/rails";
import { SideLink } from "@/components/layout/nav-link";
import { MiniFooter } from "@/components/layout/site-footer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/misc";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { formatCount } from "@/lib/utils";
import { getMemberCompanies } from "@/server/queries/companies";
import { getFeed, type FeedMode } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Feed");

const TABS: { value: FeedMode; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "following", label: "Following" },
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending" },
];

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const { tab } = await searchParams;
  const mode = TABS.find((t) => t.value === tab)?.value ?? "for-you";
  const viewer = { id: user.id, role: user.role };

  const [[profile], categories, companies] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    getActiveCategories(),
    getMemberCompanies(user.id),
  ]);
  const initial = await getFeed({ viewer, mode, interests: profile?.domains });
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <aside className="hidden space-y-4 lg:block">
        <Card className="overflow-hidden">
          <div className="h-14 bg-primary-soft" />
          <div className="-mt-7 px-4 pb-4">
            <Link href={`/u/${user.username}`}>
              <Avatar name={user.name} fileId={user.avatarFileId} size="lg" className="border-2 border-card" />
            </Link>
            <Link href={`/u/${user.username}`} className="mt-2 block truncate text-[14px] font-semibold hover:underline">
              {user.name}
            </Link>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{user.headline ?? `@${user.username}`}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
              <div>
                <dt className="text-subtle">Connections</dt>
                <dd className="font-semibold">{formatCount(profile?.connectionCount ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Followers</dt>
                <dd className="font-semibold">{formatCount(profile?.followerCount ?? 0)}</dd>
              </div>
            </dl>
          </div>
        </Card>
        <nav aria-label="Shortcuts" className="space-y-0.5">
          <SideLink href={`/u/${user.username}`} icon={<UserRound />}>My profile</SideLink>
          <SideLink href="/network" icon={<Users />}>My network</SideLink>
          <SideLink href="/achievements" icon={<Award />}>Achievements</SideLink>
          <SideLink href="/bookmarks" icon={<Bookmark />}>Bookmarks</SideLink>
          <SideLink href="/articles" icon={<FileText />}>Articles</SideLink>
          <SideLink href="/jobs/applications" icon={<BriefcaseBusiness />}>My applications</SideLink>
          <SideLink href="/companies" icon={<Building2 />}>Companies</SideLink>
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <h1 className="sr-only">Your feed</h1>
        <LinkTabs items={TABS.map((t) => ({ ...t, href: t.value === "for-you" ? "/feed" : `/feed?tab=${t.value}` }))} current={mode} />
        <FeedList
          key={mode}
          initial={initial}
          request={{ mode }}
          context={{ viewer: { name: user.name, avatarFileId: user.avatarFileId }, categories: categoryNames }}
          composer={{
            categories,
            defaultCategory: profile?.domains[0],
            companies: companies.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name })),
          }}
          emptyTitle={mode === "following" ? "Your following feed is empty" : "Nothing to show yet"}
          emptyDescription={
            mode === "following"
              ? "Follow people and companies to see what they share here."
              : "Be the first to share something — a write-up, a question, or what you are working on."
          }
          emptyAction={
            <Button asChild variant="outline" size="sm">
              <Link href="/network?tab=discover">Find people to follow</Link>
            </Button>
          }
        />
      </div>

      <aside className="hidden space-y-4 xl:block">
        <LatestJobsCard viewerId={user.id} />
        <SuggestedPeopleCard viewerId={user.id} />
        <TrendingTagsCard />
        <MiniFooter />
      </aside>
    </div>
  );
}
