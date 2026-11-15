import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { FeedRefresher } from "@/components/feed/feed-refresher";
import { TrendingTagsCard } from "@/components/feed/rails";
import { JobBoardCard } from "@/components/jobs/job-board-card";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { memo } from "@/lib/cache";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { pageMetadata, platformOrganizationLd, websiteLd } from "@/lib/seo";
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
 * The home page is the feed. Visitors see what members and the news account are posting plus
 * the live job board; members are sent to their own feed, where they can also post.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? "/feed" : "/onboarding");

  const mode = (await searchParams).tab === "trending" ? "trending" : "latest";
  const [categories, posts] = await Promise.all([
    getActiveCategories(),
    // The first page is the same for every visitor, so it is computed at most twice a minute.
    memo(`feed:public:${mode}`, 30_000, () => getFeed({ viewer: null, mode })),
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
              With an account you can like and comment, share your own research, follow people and build a profile with your experience and certifications.
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
            current={mode}
            items={[
              { value: "latest", label: "Latest", href: "/" },
              { value: "trending", label: "Trending", href: "/?tab=trending" },
            ]}
          />
          <p className="font-mono text-[11px] leading-relaxed text-subtle">
            Security news is posted by CyberGram News from {NEWS_SOURCES.length} named sources and refreshed every 30 minutes. Members&rsquo; posts appear alongside it.
          </p>
          {/* Jobs sit inside the feed on small screens, where there is no side rail. */}
          <JobBoardCard limit={4} className="lg:hidden" />
          <FeedList
            key={`${mode}:${posts.posts[0]?.id ?? "empty"}`}
            initial={posts}
            request={{ mode }}
            context={{ viewer: null, categories: Object.fromEntries(categories.map((c) => [c.slug, c.name])) }}
            emptyTitle="The feed is filling up"
            emptyDescription="Security news and members' posts appear here within half an hour of the first start."
            emptyAction={
              <Button asChild size="sm">
                <Link href="/register">Be the first to post</Link>
              </Button>
            }
          />
        </div>

        <aside className="hidden min-w-0 space-y-5 lg:block">
          <JobBoardCard limit={10} />
          <TrendingTagsCard />
        </aside>
      </div>
    </>
  );
}
