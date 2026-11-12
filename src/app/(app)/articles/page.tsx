import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FeedList } from "@/components/feed/feed-list";
import { TrendingTagsCard } from "@/components/feed/rails";
import { MiniFooter } from "@/components/layout/site-footer";
import { PageColumns } from "@/components/shared/fields";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { LinkTabs, PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { POST_TYPE_LABELS, type PostType } from "@/lib/constants";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Cybersecurity Articles, CTF Write-ups and Research",
  description: "Long-form technical writing from security practitioners: CTF write-ups, vulnerability research, responsible disclosures and how-to guides.",
  path: "/articles",
});

const TYPES: PostType[] = ["article", "ctf_writeup", "research", "disclosure"];

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const selected = TYPES.find((t) => t === type);
  const user = await getCurrentUser();
  const [initial, categories] = await Promise.all([
    getFeed({ viewer: user ? { id: user.id, role: user.role } : null, longForm: true, type: selected }),
    getCategoryNames(),
  ]);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }])} />
      <PageHeader
        title="Articles & write-ups"
        description="Long-form technical writing from the community. Authors are responsible for only publishing findings they are authorised to disclose."
        action={
          <Button asChild>
            <Link href="/articles/new">
              <PenLine /> Write an article
            </Link>
          </Button>
        }
      />
      <PageColumns
        aside={
          <>
            <TrendingTagsCard />
            <MiniFooter />
          </>
        }
      >
        <LinkTabs
          current={selected ?? "all"}
          items={[{ value: "all", label: "All", href: "/articles" }, ...TYPES.map((t) => ({ value: t, label: POST_TYPE_LABELS[t], href: `/articles?type=${t}` }))]}
        />
        <FeedList
          key={selected ?? "all"}
          initial={initial}
          request={{ longForm: true, type: selected }}
          context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories }}
          emptyTitle="No articles yet"
          emptyDescription="Write-ups, research and guides published by members will be listed here."
        />
      </PageColumns>
    </div>
  );
}
