import type { Metadata } from "next";
import Link from "next/link";
import { FeedList } from "@/components/feed/feed-list";
import { LatestJobsCard, TrendingTagsCard } from "@/components/feed/rails";
import { MiniFooter } from "@/components/layout/site-footer";
import { PageColumns } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { formatCount } from "@/lib/utils";
import { getCategoryPostCounts, getFeed } from "@/server/queries/posts";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Explore Cybersecurity Topics, Research and Write-ups",
  description:
    "Browse cybersecurity by domain — VAPT, red teaming, SOC, cloud security, AppSec, AI security, malware analysis, DFIR, threat intelligence, GRC, bug bounty and CTF.",
  path: "/explore",
});

export default async function ExplorePage() {
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const [categories, counts, trending] = await Promise.all([getActiveCategories(), getCategoryPostCounts(), getFeed({ viewer, mode: "trending" })]);
  const categoryNames = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  return (
    <div className="space-y-6">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Explore", path: "/explore" }])} />
      <PageHeader title="Explore cybersecurity" description="Every post, article and discussion is filed under a security domain. Pick one to see what practitioners are sharing." />

      <section aria-labelledby="domains">
        <h2 id="domains" className="sr-only">Security domains</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link href={`/explore/${category.slug}`} className="group flex h-full flex-col rounded-xl border bg-card p-4 shadow-card transition-colors hover:border-border-strong">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold group-hover:text-primary">{category.name}</span>
                  <span className="shrink-0 text-xs text-subtle">{formatCount(counts[category.slug] ?? 0)} posts</span>
                </span>
                <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{category.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PageColumns
        aside={
          <>
            <TrendingTagsCard />
            <LatestJobsCard viewerId={user?.id} />
            <MiniFooter />
          </>
        }
      >
        <h2 className="text-[15px] font-semibold">Trending across the community</h2>
        <FeedList
          initial={trending}
          request={{ mode: "trending" }}
          context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories: categoryNames }}
          emptyTitle="No public posts yet"
          emptyDescription="When members share research, write-ups and questions, the most discussed ones appear here."
        />
      </PageColumns>
    </div>
  );
}
