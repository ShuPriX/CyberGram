"use client";

import {
  BadgeCheck,
  Bookmark,
  Ellipsis,
  FileText,
  Flag,
  Globe,
  Heart,
  Link2,
  MessageCircle,
  Pencil,
  Repeat2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ReportDialog } from "@/components/shared/report-dialog";
import { EXTERNAL_LINK_PROPS, RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionForm, FormError, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { TimeAgo } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LIMITS, POST_TYPE_LABELS } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { cn, displayHost, formatBytes, formatCount } from "@/lib/utils";
import { deletePostAction, repostAction, toggleBookmarkAction, toggleLikeAction, updatePostAction } from "@/server/actions/posts";
import type { FeedPost, PostAttachment } from "@/server/queries/posts";
import { Comments, type CommentViewer } from "./comments";

export type PostCardContext = {
  viewer: CommentViewer;
  categories: Record<string, string>;
};

const postHref = (post: FeedPost) => (post.slug ? `/articles/${post.slug}` : `/posts/${post.id}`);

function Attachments({ items }: { items: PostAttachment[] }) {
  const media = items.filter((a) => a.mime.startsWith("image/") || a.mime.startsWith("video/"));
  const documents = items.filter((a) => !media.includes(a));
  return (
    <div className="mt-3 space-y-2">
      {media.length > 0 ? (
        <div className={cn("grid gap-1 overflow-hidden rounded-lg border", media.length > 1 && "grid-cols-2")}>
          {media.map((item) =>
            item.mime.startsWith("video/") ? (
              <video key={item.id} src={`/api/files/${item.id}`} controls preload="metadata" className="max-h-[480px] w-full bg-black" />
            ) : (
              <a key={item.id} href={`/api/files/${item.id}`} target="_blank" rel="noopener" className="block bg-muted">
                <img
                  src={`/api/files/${item.id}`}
                  alt=""
                  width={item.width ?? undefined}
                  height={item.height ?? undefined}
                  loading="lazy"
                  decoding="async"
                  className={cn("w-full object-cover", media.length > 1 ? "aspect-square" : "max-h-[520px] object-contain")}
                />
              </a>
            ),
          )}
        </div>
      ) : null}
      {documents.map((item) => (
        <a
          key={item.id}
          href={`/api/files/${item.id}`}
          className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent"
          download
        >
          <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(item.size)}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

function PostBody({ post, expandedByDefault }: { post: FeedPost; expandedByDefault: boolean }) {
  const [expanded, setExpanded] = useState(expandedByDefault);
  const isLongForm = Boolean(post.slug);

  if (isLongForm) {
    return (
      <Link href={postHref(post)} className="group mt-3 block rounded-lg border p-4 transition-colors hover:border-border-strong">
        <h3 className="text-base font-semibold leading-snug group-hover:text-primary">{post.title}</h3>
        {post.excerpt ? <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-muted-foreground">{post.excerpt}</p> : null}
        <span className="mt-2 inline-block text-[13px] font-medium text-primary">Read {POST_TYPE_LABELS[post.type].toLowerCase()}</span>
      </Link>
    );
  }

  const long = post.body.length > 600 || post.body.split("\n").length > 10;
  return (
    <div className="mt-3">
      {post.title ? <h3 className="mb-1.5 text-base font-semibold leading-snug">{post.title}</h3> : null}
      {post.body ? (
        <>
          <RichText
            text={post.body}
            mentions={post.mentions}
            className={cn("text-[14.5px] leading-relaxed", long && !expanded && "line-clamp-fade max-h-52 overflow-hidden")}
          />
          {long && !expanded ? (
            <button type="button" onClick={() => setExpanded(true)} className="mt-1 text-[13px] font-medium text-primary hover:underline">
              Show more
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PostHeader({ post, categories, compact }: { post: FeedPost; categories: Record<string, string>; compact?: boolean }) {
  const actor = post.company
    ? { href: `/companies/${post.company.slug}`, name: post.company.name, fileId: post.company.logoFileId, shape: "square" as const }
    : { href: `/u/${post.author.username}`, name: post.author.name, fileId: post.author.avatarFileId, shape: "circle" as const };
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <Link href={actor.href} className="shrink-0">
        <Avatar name={actor.name} fileId={actor.fileId} shape={actor.shape} size={compact ? "sm" : "md"} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[14px] leading-tight">
          <Link href={actor.href} className="truncate font-semibold hover:underline">
            {actor.name}
          </Link>
          {post.company?.verified ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified organisation" /> : null}
          {post.community ? (
            <span className="truncate text-muted-foreground">
              in{" "}
              <Link href={`/communities/${post.community.slug}`} className="font-medium hover:underline">
                {post.community.name}
              </Link>
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {post.company ? `Posted by ${post.author.name}` : (post.author.headline ?? `@${post.author.username}`)}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
          <Link href={postHref(post)} className="hover:underline">
            <TimeAgo date={post.createdAt} />
          </Link>
          {post.editedAt ? <span>· Edited</span> : null}
          <span aria-hidden="true">·</span>
          {post.visibility === "connections" ? (
            <span className="inline-flex items-center gap-1" title="Visible to connections only">
              <Users className="size-3" /> Connections
            </span>
          ) : (
            <Globe className="size-3" aria-label="Public" />
          )}
          <span aria-hidden="true">·</span>
          <Link href={`/explore/${post.category}`} className="hover:text-foreground hover:underline">
            {categories[post.category] ?? post.category}
          </Link>
        </p>
      </div>
    </div>
  );
}

function EditDialog({
  post,
  categories,
  open,
  onOpenChange,
  onSaved,
}: {
  post: FeedPost;
  categories: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (post: FeedPost) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit post">
        <ActionForm<FeedPost | null>
          action={updatePostAction}
          onSuccess={(updated) => {
            if (updated) onSaved(updated);
            onOpenChange(false);
          }}
          className="space-y-4"
        >
          <FormError />
          <input type="hidden" name="id" value={post.id} />
          <TextareaField label="Post" name="body" defaultValue={post.body} rows={8} required maxLength={LIMITS.postBody} />
          <SelectField
            label="Category"
            name="category"
            defaultValue={post.category}
            options={Object.entries(categories).map(([value, label]) => ({ value, label }))}
          />
          <div className="flex justify-end">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}

export function PostCard({
  post: initial,
  context,
  onRemoved,
  detail = false,
}: {
  post: FeedPost;
  context: PostCardContext;
  onRemoved?: (id: string) => void;
  /** Full-page view: body expanded and comments open. */
  detail?: boolean;
}) {
  const [post, setPost] = useState(initial);
  const [showComments, setShowComments] = useState(detail);
  const [dialog, setDialog] = useState<"edit" | "report" | "quote" | null>(null);
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  const { viewer, categories } = context;

  // A plain repost is rendered as the original, attributed to whoever shared it.
  const plainRepost = post.isRepost && !post.body;
  const subject = plainRepost && post.repostOf ? post.repostOf : post;
  const patch = (changes: Partial<FeedPost>, viewerChanges?: Partial<FeedPost["viewer"]>) =>
    setPost((current) => {
      const apply = (p: FeedPost): FeedPost => ({ ...p, ...changes, viewer: { ...p.viewer, ...viewerChanges } });
      return plainRepost && current.repostOf ? { ...current, repostOf: apply(current.repostOf) } : apply(current);
    });

  if (removed) return null;

  function requireViewer(action: string): boolean {
    if (viewer) return true;
    toast.info(`Sign in to ${action}.`);
    return false;
  }

  function like() {
    if (!requireViewer("like posts")) return;
    const next = !subject.viewer.liked;
    patch({ likeCount: subject.likeCount + (next ? 1 : -1) }, { liked: next });
    startTransition(async () => {
      const result = await toggleLikeAction({ id: subject.id });
      if (!result?.ok) {
        patch({ likeCount: subject.likeCount }, { liked: !next });
        toast.error(result?.error ?? "Could not update your like.");
      }
    });
  }

  function bookmark() {
    if (!requireViewer("save posts")) return;
    const next = !subject.viewer.bookmarked;
    patch({}, { bookmarked: next });
    startTransition(async () => {
      const result = await toggleBookmarkAction({ id: subject.id });
      if (!result?.ok) patch({}, { bookmarked: !next });
      else if (result.message) toast.success(result.message);
    });
  }

  function repost(body?: string) {
    if (!requireViewer("repost")) return;
    startTransition(async () => {
      const result = await repostAction({ id: subject.id, body });
      if (!result?.ok) return void toast.error(result?.error ?? "Could not repost.");
      const reposted = (result.data as { reposted: boolean } | undefined)?.reposted ?? true;
      patch({ repostCount: Math.max(0, subject.repostCount + (reposted ? 1 : -1)) }, { reposted });
      if (result.message) toast.success(result.message);
      setDialog(null);
    });
  }

  function remove() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deletePostAction({ id: post.id });
      if (!result?.ok) return void toast.error(result?.error ?? "Could not delete the post.");
      toast.success("Post removed.");
      setRemoved(true);
      onRemoved?.(post.id);
    });
  }

  async function share() {
    const url = `${window.location.origin}${postHref(subject)}`;
    try {
      if (navigator.share) await navigator.share({ url, title: subject.title ?? `Post by ${subject.author.name}` });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard.");
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${postHref(subject)}`);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  const actionClass =
    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  return (
    <article className="rounded-xl border bg-card shadow-card">
      {plainRepost ? (
        <p className="flex items-center gap-1.5 border-b px-4 py-2 text-xs text-muted-foreground sm:px-5">
          <Repeat2 className="size-3.5" aria-hidden="true" />
          <Link href={`/u/${post.author.username}`} className="font-medium text-foreground hover:underline">
            {post.author.name}
          </Link>
          reposted
        </p>
      ) : null}

      <div className="p-4 sm:p-5">
        {plainRepost && !post.repostOf ? (
          <p className="text-[13px] text-muted-foreground">The original post is no longer available.</p>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <PostHeader post={subject} categories={categories} />
              {subject.type !== "post" ? <Badge variant="primary" className="hidden sm:inline-flex">{POST_TYPE_LABELS[subject.type]}</Badge> : null}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="-mr-1.5 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Post options"
                >
                  <Ellipsis className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={copyLink}>
                    <Link2 /> Copy link
                  </DropdownMenuItem>
                  {post.viewer.isAuthor && !plainRepost && !post.slug ? (
                    <DropdownMenuItem onSelect={() => setDialog("edit")}>
                      <Pencil /> Edit post
                    </DropdownMenuItem>
                  ) : null}
                  {post.viewer.isAuthor && post.slug ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/articles/${post.slug}/edit`}>
                        <Pencil /> Edit article
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                  {post.viewer.isAuthor || post.viewer.canModerate ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={remove}>
                        <Trash2 /> {post.viewer.isAuthor ? (plainRepost ? "Undo repost" : "Delete post") : "Remove (moderator)"}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                  {viewer && !subject.viewer.isAuthor ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setDialog("report")}>
                        <Flag /> Report
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <PostBody post={subject} expandedByDefault={detail} />

            {subject.linkUrl ? (
              <a
                href={leavingHref(subject.linkUrl)}
                className="mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] transition-colors hover:bg-accent"
                {...EXTERNAL_LINK_PROPS}
              >
                <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{displayHost(subject.linkUrl)}</span>
                <span className="hidden max-w-[50%] truncate text-xs text-subtle sm:inline">{subject.linkUrl}</span>
              </a>
            ) : null}

            {subject.attachments.length > 0 ? <Attachments items={subject.attachments} /> : null}

            {/* Quoted original for reposts with commentary */}
            {post.isRepost && !plainRepost ? (
              post.repostOf ? (
                <div className="mt-3 rounded-lg border p-3.5">
                  <PostHeader post={post.repostOf} categories={categories} compact />
                  <PostBody post={post.repostOf} expandedByDefault={false} />
                  {post.repostOf.attachments.length > 0 ? <Attachments items={post.repostOf.attachments} /> : null}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed p-3.5 text-[13px] text-muted-foreground">The original post is no longer available.</p>
              )
            ) : null}

            {subject.likeCount + subject.commentCount + subject.repostCount > 0 ? (
              <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {subject.likeCount > 0 ? <span>{formatCount(subject.likeCount)} {subject.likeCount === 1 ? "like" : "likes"}</span> : null}
                {subject.commentCount > 0 ? (
                  <button type="button" onClick={() => setShowComments(true)} className="hover:underline">
                    {formatCount(subject.commentCount)} {subject.commentCount === 1 ? "comment" : "comments"}
                  </button>
                ) : null}
                {subject.repostCount > 0 ? <span>{formatCount(subject.repostCount)} {subject.repostCount === 1 ? "repost" : "reposts"}</span> : null}
              </p>
            ) : null}

            <div className="-mx-1.5 mt-2 flex items-center border-t pt-1.5">
              <button type="button" onClick={like} aria-pressed={subject.viewer.liked} className={cn(actionClass, subject.viewer.liked && "text-primary hover:text-primary")}>
                <Heart className={cn("size-[18px]", subject.viewer.liked && "fill-current")} />
                <span className="hidden sm:inline">Like</span>
              </button>
              <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} className={actionClass}>
                <MessageCircle className="size-[18px]" />
                <span className="hidden sm:inline">Comment</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(actionClass, subject.viewer.reposted && "text-primary hover:text-primary")} disabled={subject.visibility !== "public"}>
                  <Repeat2 className="size-[18px]" />
                  <span className="hidden sm:inline">Repost</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem onSelect={() => repost()}>
                    <Repeat2 /> {subject.viewer.reposted ? "Undo repost" : "Repost"}
                  </DropdownMenuItem>
                  {!subject.viewer.reposted ? (
                    <DropdownMenuItem onSelect={() => requireViewer("repost") && setDialog("quote")}>
                      <Pencil /> Repost with your thoughts
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
              <button type="button" onClick={bookmark} aria-pressed={subject.viewer.bookmarked} className={cn(actionClass, subject.viewer.bookmarked && "text-primary hover:text-primary")}>
                <Bookmark className={cn("size-[18px]", subject.viewer.bookmarked && "fill-current")} />
                <span className="hidden sm:inline">Save</span>
              </button>
              <button type="button" onClick={share} className={actionClass}>
                <Share2 className="size-[18px]" />
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>
          </>
        )}
      </div>

      {showComments && subject ? (
        <div className="border-t px-4 py-4 sm:px-5">
          <Comments postId={subject.id} viewer={viewer} onCountChange={(delta) => patch({ commentCount: Math.max(0, subject.commentCount + delta) })} />
        </div>
      ) : null}

      {dialog === "edit" ? (
        <EditDialog post={post} categories={categories} open onOpenChange={(open) => !open && setDialog(null)} onSaved={(updated) => setPost(updated)} />
      ) : null}
      {dialog === "report" ? (
        <ReportDialog open onOpenChange={(open) => !open && setDialog(null)} targetType="post" targetId={subject.id} />
      ) : null}
      {dialog === "quote" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent title="Repost with your thoughts">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                repost(String(new FormData(event.currentTarget).get("body") ?? ""));
              }}
            >
              <textarea
                name="body"
                rows={4}
                required
                maxLength={1000}
                autoFocus
                placeholder="What do you want to add?"
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none"
              />
              <div className="flex justify-end">
                <Button type="submit">Repost</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  );
}
