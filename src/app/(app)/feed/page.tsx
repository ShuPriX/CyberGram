import { and, count, eq } from "drizzle-orm";
import { Award, Bookmark, BriefcaseBusiness, Building2, Check, FileText, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { FeedList } from "@/components/feed/feed-list";
import { FeedRefresher } from "@/components/feed/feed-refresher";
import { NewsBrief, NewsList } from "@/components/feed/news";
import { SuggestedPeopleCard, TrendingTagsCard } from "@/components/feed/rails";
import { JobBoardCard } from "@/components/jobs/job-board-card";
import { SideLink } from "@/components/layout/nav-link";
import { MiniFooter } from "@/components/layout/site-footer";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/misc";
import { db } from "@/db";
import { achievements, experiences, profiles } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { privateMetadata } from "@/lib/seo";
import { cn, formatCount } from "@/lib/utils";
import { getMemberCompanies } from "@/server/queries/companies";
import { listNews } from "@/server/queries/news";
import { getFeed, type FeedMode } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Feed");

const POST_TABS: { value: FeedMode; label: string }[] = [
  { value: "for-you", label: "For you" },
  { value: "following", label: "Following" },
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending" },
];

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireOnboardedUser();
  const { tab } = await searchParams;
  const showNews = tab === "news";
  const mode = POST_TABS.find((t) => t.value === tab)?.value ?? "for-you";
  const viewer = { id: user.id, role: user.role };

  const [[profile], categories, companies, [experienceCount], [certificationCount], news] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1),
    getActiveCategories(),
    getMemberCompanies(user.id),
    db.select({ value: count() }).from(experiences).where(eq(experiences.userId, user.id)),
    db.select({ value: count() }).from(achievements).where(and(eq(achievements.userId, user.id), eq(achievements.type, "certification"))),
    listNews({ limit: showNews ? 40 : 5 }),
  ]);
  const initial = showNews ? null : await getFeed({ viewer, mode, interests: profile?.domains });
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  // What a complete profile has. Each open item links to where it is filled in.
  const checklist = [
    { label: "Photo", done: Boolean(profile?.avatarFileId), href: "/profile/edit" },
    { label: "About you", done: Boolean(profile?.bio), href: "/profile/edit" },
    { label: "Where you work", done: Boolean(profile?.currentCompany), href: "/profile/edit" },
    { label: "Experience", done: (experienceCount?.value ?? 0) > 0, href: "/profile/edit#experience" },
    { label: "Certifications", done: (certificationCount?.value ?? 0) > 0, href: "/profile/edit#certifications" },
  ];
  const open = checklist.filter((item) => !item.done);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[270px_minmax(0,1fr)_400px]">
      <FeedRefresher />

      <aside className="hidden space-y-4 xl:block">
        <Card className="overflow-hidden">
          <div className="h-14 border-b bg-secondary" />
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

        {open.length > 0 ? (
          <div className="border p-4">
            <h2 className="label-mono text-muted-foreground">
              Your profile · {checklist.length - open.length}/{checklist.length}
            </h2>
            <ul className="mt-2.5 space-y-1.5">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={cn("flex items-center gap-2 text-[13px]", item.done ? "text-subtle" : "text-foreground hover:text-primary")}>
                    <span className={cn("flex size-4 items-center justify-center border", item.done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                      {item.done ? <Check className="size-3" aria-hidden="true" /> : null}
                    </span>
                    {item.done ? item.label : `Add ${item.label.toLowerCase()}`}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
        <LinkTabs
          items={[
            ...POST_TABS.map((t) => ({ ...t, href: t.value === "for-you" ? "/feed" : `/feed?tab=${t.value}` })),
            { value: "news", label: "News", href: "/feed?tab=news" },
          ]}
          current={showNews ? "news" : mode}
        />

        {showNews ? (
          <>
            <p className="font-mono text-[11px] leading-relaxed text-subtle">
              Headlines from {NEWS_SOURCES.length} named sources — national cyber agencies, security research teams and established security press. Refreshed every 30 minutes.
            </p>
            <NewsList items={news} />
          </>
        ) : (
          <>
            {mode === "for-you" || mode === "latest" ? <NewsBrief items={news} /> : null}
            {/* Jobs sit inside the feed on small screens, where there is no side rail. */}
            <JobBoardCard limit={4} viewerId={user.id} className="lg:hidden" />
            <FeedList
              // Remounts when a refresh brings a newer post to the top, so the list starts from fresh data.
              key={`${mode}:${initial?.posts[0]?.id ?? "empty"}`}
              initial={initial ?? { posts: [], nextCursor: null }}
              request={{ mode }}
              context={{ viewer: { name: user.name, avatarFileId: user.avatarFileId }, categories: categoryNames }}
              composer={{
                categories,
                defaultCategory: profile?.domains[0],
                companies: companies.filter((c) => c.status === "active").map((c) => ({ id: c.id, name: c.name })),
              }}
              emptyTitle={mode === "following" ? "Your following feed is empty" : "No posts yet"}
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
          </>
        )}
      </div>

      <aside className="hidden min-w-0 space-y-4 lg:block">
        <JobBoardCard limit={8} viewerId={user.id} />
        <SuggestedPeopleCard viewerId={user.id} />
        <TrendingTagsCard />
        <MiniFooter />
      </aside>
    </div>
  );
}
