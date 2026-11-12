import Link from "next/link";
import { FeedList } from "@/components/feed/feed-list";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Bookmarks");

export default async function BookmarksPage() {
  const user = await requireOnboardedUser();
  const [initial, categories] = await Promise.all([getFeed({ viewer: { id: user.id, role: user.role }, bookmarkedBy: user.id }), getCategoryNames()]);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Bookmarks" description="Posts and articles you saved. Only you can see this list." />
      <FeedList
        initial={initial}
        request={{ bookmarks: true }}
        context={{ viewer: { name: user.name, avatarFileId: user.avatarFileId }, categories }}
        emptyTitle="No bookmarks yet"
        emptyDescription="Use the bookmark icon on any post to keep it here for later."
        emptyAction={
          <Button asChild variant="outline" size="sm">
            <Link href="/explore">Explore posts</Link>
          </Button>
        }
      />
    </div>
  );
}
