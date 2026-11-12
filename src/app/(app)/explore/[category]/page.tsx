import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { TrendingTagsCard } from "@/components/feed/rails";
import { JobCard } from "@/components/jobs/job-card";
import { MiniFooter } from "@/components/layout/site-footer";
import { PageColumns } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { LinkTabs, PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { JOB_CATEGORIES } from "@/lib/constants";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { listCommunities } from "@/server/queries/community";
import { listJobs } from "@/server/queries/jobs";
import { getFeed } from "@/server/queries/posts";
import { getActiveCategories, getCategory } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).category);
  if (!category) return { title: "Not found" };
  return pageMetadata({
    title: `${category.name} — Posts, Research and Discussions`,
    description: `${category.description} Read what cybersecurity professionals are sharing about ${category.name}.`,
    path: `/explore/${category.slug}`,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ category: slug }, { sort }] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();
  const mode = sort === "trending" ? "trending" : "latest";
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const jobCategories = JOB_CATEGORIES.filter((c) => c.domain === category.slug).map((c) => c.slug);

  const [categories, initial, jobs, communities] = await Promise.all([
    getActiveCategories(),
    getFeed({ viewer, mode, category: category.slug }),
    jobCategories.length > 0 ? listJobs({ categories: jobCategories, pageSize: 3, viewerId: user?.id }) : null,
    listCommunities(user?.id ?? null),
  ]);
  const related = communities.filter((c) => c.category === category.slug).slice(0, 4);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Explore", path: "/explore" }, { name: category.name, path: `/explore/${category.slug}` }])} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/explore" className="hover:text-foreground">Explore</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page">{category.name}</span>
      </nav>
      <PageHeader title={category.name} description={category.description} />
      <PageColumns
        aside={
          <>
            {related.length > 0 ? (
              <Card>
                <CardContent className="space-y-3">
                  <CardTitle className="text-[13px] uppercase tracking-wider text-subtle">Communities</CardTitle>
                  <ul className="space-y-2.5">
                    {related.map((community) => (
                      <li key={community.id}>
                        <Link href={`/communities/${community.slug}`} className="group block">
                          <span className="text-[13px] font-medium group-hover:text-primary">{community.name}</span>
                          <span className="block text-xs text-muted-foreground">{community.memberCount} members</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <TrendingTagsCard />
            <MiniFooter />
          </>
        }
      >
        {jobs && jobs.items.length > 0 ? (
          <section aria-labelledby="category-jobs" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="category-jobs" className="text-[15px] font-semibold">Open {category.name} roles</h2>
              <Link href={`/jobs?${jobCategories.map((c) => `category=${c}`).join("&")}`} className="text-[13px] font-medium text-primary hover:underline">
                View all {jobs.total}
              </Link>
            </div>
            {jobs.items.map((job) => (
              <JobCard key={job.id} job={job} compact />
            ))}
          </section>
        ) : null}
        <LinkTabs
          current={mode}
          items={[
            { value: "latest", label: "Latest", href: `/explore/${category.slug}` },
            { value: "trending", label: "Trending", href: `/explore/${category.slug}?sort=trending` },
          ]}
        />
        <FeedList
          key={mode}
          initial={initial}
          request={{ mode, category: category.slug }}
          context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories: Object.fromEntries(categories.map((c) => [c.slug, c.name])) }}
          composer={user?.onboarded ? { categories, defaultCategory: category.slug } : undefined}
          emptyTitle={`Nothing in ${category.name} yet`}
          emptyDescription="Be the first to share a finding, a write-up or a question in this domain."
        />
      </PageColumns>
    </div>
  );
}
