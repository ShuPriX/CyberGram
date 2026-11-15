import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { FeedRefresher } from "@/components/feed/feed-refresher";
import { NewsBrief, NewsList } from "@/components/feed/news";
import { TrendingTagsCard } from "@/components/feed/rails";
import { JobBoardCard } from "@/components/jobs/job-board-card";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { pageMetadata, platformOrganizationLd, websiteLd } from "@/lib/seo";
import { listNews } from "@/server/queries/news";
import { getFeed } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata: Metadata = {
  ...pageMetadata({
    title: `${APP_NAME} — Cybersecurity News, Community and Jobs`,
    description: APP_DESCRIPTION,
    path: "/",
  }),
  title: { absolute: `${APP_NAME} — Cybersecurity News, Community and Jobs` },
};

const SHELL = "mx-auto w-full max-w-[1760px] px-4 sm:px-6 xl:px-10";

/**
 * The home page is the feed. Visitors get the security news desk, public community posts and
 * the live job board; members are sent to their own feed, where they can also post.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? "/feed" : "/onboarding");

  const tab = (await searchParams).tab === "community" ? "community" : "news";
  const [categories, news, posts] = await Promise.all([
    getActiveCategories(),
    listNews({ limit: tab === "news" ? 40 : 6 }),
    tab === "community" ? getFeed({ viewer: null, mode: "trending" }) : null,
  ]);

  return (
    <>
      <JsonLd data={[websiteLd(), platformOrganizationLd()]} />
      <FeedRefresher />

      {/* Who this is for, in one band. The feed starts immediately below. */}
      <section className="border-b bg-card">
        <div className={`${SHELL} flex flex-col gap-5 py-7 lg:flex-row lg:items-end lg:justify-between`}>
          <div className="min-w-0">
            <p className="label-mono text-primary">Built by the security community, for the security community</p>
            <h1 className="mt-2.5 max-w-4xl text-balance text-3xl font-bold uppercase leading-[1.05] sm:text-4xl xl:text-[2.75rem]">
              Where cybersecurity professionals connect, build <span className="text-primary">&amp; get hired.</span>
            </h1>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Join the Community <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/jobs">Explore Cybersecurity Jobs</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className={`${SHELL} grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[250px_minmax(0,1fr)_400px]`}>
        <aside className="hidden space-y-5 xl:block">
          <nav aria-label="Security domains">
            <h2 className="label-mono text-muted-foreground">Domains</h2>
            <ul className="mt-2.5 border-l">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link href={`/explore/${category.slug}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-[13px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="border p-4">
            <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.04em]">Post, follow, get found</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              With an account you can share your own research, follow people and build a profile with your experience and certifications.
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href="/register">Create an account</Link>
            </Button>
            <p className="mt-2 text-center text-xs text-subtle">
              Already a member?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <LinkTabs
            current={tab}
            items={[
              { value: "news", label: "Security news", href: "/" },
              { value: "community", label: "Community posts", href: "/?tab=community" },
            ]}
          />
          {tab === "news" ? (
            <>
              <p className="font-mono text-[11px] leading-relaxed text-subtle">
                Headlines from {NEWS_SOURCES.length} named sources — national cyber agencies, security research teams and established security press. Refreshed every 30
                minutes. Every item links to the original.
              </p>
              {/* Jobs sit inside the feed on small screens, where there is no side rail. */}
              <JobBoardCard limit={4} className="lg:hidden" />
              <NewsList items={news} />
            </>
          ) : (
            <>
              <NewsBrief items={news} href="/" />
              <FeedList
                key={posts?.posts[0]?.id ?? "empty"}
                initial={posts ?? { posts: [], nextCursor: null }}
                request={{ mode: "trending" }}
                context={{ viewer: null, categories: Object.fromEntries(categories.map((c) => [c.slug, c.name])) }}
                emptyTitle="No public posts yet"
                emptyDescription="When members share research, write-ups and questions, the most discussed ones appear here."
                emptyAction={
                  <Button asChild size="sm">
                    <Link href="/register">Be the first to post</Link>
                  </Button>
                }
              />
            </>
          )}
        </div>

        <aside className="hidden min-w-0 space-y-5 lg:block">
          <JobBoardCard limit={10} />
          <TrendingTagsCard />
        </aside>
      </div>
    </>
  );
}
