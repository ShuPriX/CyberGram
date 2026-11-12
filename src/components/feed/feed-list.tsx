"use client";

import { Newspaper } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { loadFeedAction, type FeedRequest } from "@/server/actions/posts";
import type { FeedPage, FeedPost } from "@/server/queries/posts";
import { Composer } from "./composer";
import { PostCard, type PostCardContext } from "./post-card";

type ComposerConfig = Omit<React.ComponentProps<typeof Composer>, "onPosted" | "viewer">;

export function PostSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5" aria-hidden="true">
      <div className="flex gap-3">
        <Skeleton className="size-10 rounded-sm" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <Skeleton className="mt-4 h-3.5 w-full" />
      <Skeleton className="mt-2 h-3.5 w-11/12" />
      <Skeleton className="mt-2 h-3.5 w-2/3" />
    </div>
  );
}

/**
 * A feed with cursor-based infinite scrolling. The first page is rendered on the server and
 * passed in; further pages are fetched as the sentinel scrolls into view. New posts from the
 * composer are prepended without a reload.
 */
export function FeedList({
  initial,
  request,
  context,
  composer,
  emptyTitle = "Nothing here yet",
  emptyDescription = "When there are posts to show, they will appear here.",
  emptyAction,
}: {
  initial: FeedPage;
  /** The filters this feed was loaded with; reused for subsequent pages. */
  request: Omit<FeedRequest, "cursor">;
  context: PostCardContext;
  composer?: ComposerConfig;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const [posts, setPosts] = useState<FeedPost[]>(initial.posts);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadFeedAction({ ...request, cursor });
      setPosts((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [cursor, request]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || failed) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore]);

  return (
    <div className="space-y-4">
      {composer && context.viewer ? (
        <Composer {...composer} viewer={context.viewer} onPosted={(post) => setPosts((current) => [post, ...current])} />
      ) : null}

      {posts.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Newspaper} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} context={context} onRemoved={(id) => setPosts((current) => current.filter((p) => p.id !== id))} />
        ))
      )}

      {cursor ? (
        <div ref={sentinel}>
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-4 text-[13px] text-muted-foreground">
              Could not load more posts.
              <Button variant="outline" size="sm" onClick={() => void loadMore()}>
                Try again
              </Button>
            </div>
          ) : loading ? (
            <PostSkeleton />
          ) : (
            <div className="h-10" />
          )}
        </div>
      ) : posts.length > 6 ? (
        <p className="py-4 text-center text-xs text-subtle">You are all caught up.</p>
      ) : null}
    </div>
  );
}
