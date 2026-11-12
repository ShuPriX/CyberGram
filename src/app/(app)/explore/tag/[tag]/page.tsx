import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FeedList } from "@/components/feed/feed-list";
import { TrendingTagsCard } from "@/components/feed/rails";
import { MiniFooter } from "@/components/layout/site-footer";
import { PageColumns } from "@/components/shared/fields";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ tag: string }> };

const cleanTag = (raw: string) => {
  const tag = decodeURIComponent(raw).toLowerCase();
  return /^[\p{L}\p{N}_]{2,50}$/u.test(tag) ? tag : null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = cleanTag((await params).tag);
  if (!tag) return { title: "Not found" };
  // Hashtag pages are thin and unbounded in number, so they are kept out of the index.
  return pageMetadata({ title: `#${tag}`, description: `Posts tagged #${tag} by cybersecurity professionals.`, path: `/explore/tag/${tag}`, noindex: true });
}

export default async function TagPage({ params }: Props) {
  const tag = cleanTag((await params).tag);
  if (!tag) notFound();
  const user = await getCurrentUser();
  const [initial, categories] = await Promise.all([getFeed({ viewer: user ? { id: user.id, role: user.role } : null, hashtag: tag }), getCategoryNames()]);

  return (
    <div className="space-y-5">
      <PageHeader title={`#${tag}`} description="The latest public posts using this hashtag." />
      <PageColumns
        aside={
          <>
            <TrendingTagsCard />
            <MiniFooter />
          </>
        }
      >
        <FeedList
          initial={initial}
          request={{ hashtag: tag }}
          context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories }}
          emptyTitle="No posts with this hashtag"
          emptyDescription="Posts that include it will show up here."
        />
      </PageColumns>
    </div>
  );
}
