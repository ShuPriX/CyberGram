"use client";

import { Heart, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { RichText } from "@/components/shared/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { Skeleton, TimeAgo } from "@/components/ui/misc";
import { toast } from "@/components/ui/toast";
import { LIMITS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { addCommentAction, deleteCommentAction, loadCommentsAction, toggleCommentLikeAction } from "@/server/actions/posts";
import type { CommentItem } from "@/server/queries/posts";

export type CommentViewer = { name: string; avatarFileId: string | null } | null;

function CommentForm({
  postId,
  parentId,
  viewer,
  onAdded,
  autoFocus,
  placeholder = "Add a comment…",
}: {
  postId: string;
  parentId?: string;
  viewer: NonNullable<CommentViewer>;
  onAdded: (comment: CommentItem) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <ActionForm<CommentItem> action={addCommentAction} resetOnSuccess onSuccess={(comment) => comment && onAdded(comment)} className="flex gap-2.5">
      <Avatar name={viewer.name} fileId={viewer.avatarFileId} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1 space-y-2">
        <input type="hidden" name="postId" value={postId} />
        {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
        <Textarea
          name="body"
          rows={2}
          required
          maxLength={LIMITS.commentBody}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          className="min-h-[60px]"
        />
        <FormError />
        <div className="flex justify-end">
          <SubmitButton size="sm">{parentId ? "Reply" : "Comment"}</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

function CommentRow({
  comment,
  postId,
  viewer,
  onReplyAdded,
  onRemoved,
  isReply = false,
}: {
  comment: CommentItem;
  postId: string;
  viewer: CommentViewer;
  onReplyAdded: (reply: CommentItem) => void;
  onRemoved: (id: string) => void;
  isReply?: boolean;
}) {
  const [liked, setLiked] = useState(comment.viewer.liked);
  const [likes, setLikes] = useState(comment.likeCount);
  const [replying, setReplying] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleLike() {
    if (!viewer) return toast.info("Sign in to like comments.");
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    startTransition(async () => {
      const result = await toggleCommentLikeAction({ id: comment.id });
      if (!result?.ok) {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      }
    });
  }

  function remove() {
    if (!window.confirm("Remove this comment?")) return;
    startTransition(async () => {
      const result = await deleteCommentAction({ id: comment.id });
      if (result?.ok) onRemoved(comment.id);
      else toast.error(result?.error ?? "Could not remove the comment.");
    });
  }

  return (
    <li id={`comment-${comment.id}`} className="scroll-mt-24">
      <div className="flex gap-2.5">
        <Link href={`/u/${comment.author.username}`} className="shrink-0">
          <Avatar name={comment.author.name} fileId={comment.author.avatarFileId} size={isReply ? "xs" : "sm"} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="rounded-lg bg-muted px-3 py-2">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Link href={`/u/${comment.author.username}`} className="text-[13px] font-semibold hover:underline">
                {comment.author.name}
              </Link>
              <TimeAgo date={comment.createdAt} className="text-xs text-subtle" />
            </div>
            {comment.author.headline ? <p className="truncate text-xs text-muted-foreground">{comment.author.headline}</p> : null}
            <RichText text={comment.body} className="mt-1 text-[13.5px] leading-relaxed" />
          </div>
          <div className="mt-1 flex items-center gap-3 px-1 text-xs font-medium text-muted-foreground">
            <button type="button" onClick={toggleLike} aria-pressed={liked} className={cn("inline-flex items-center gap-1 hover:text-foreground", liked && "text-primary")}>
              <Heart className={cn("size-3.5", liked && "fill-current")} /> {likes > 0 ? likes : "Like"}
            </button>
            {viewer ? (
              <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-foreground">
                Reply
              </button>
            ) : null}
            {comment.viewer.canDelete ? (
              <button type="button" onClick={remove} disabled={pending} className="inline-flex items-center gap-1 hover:text-destructive">
                <Trash2 className="size-3.5" /> Remove
              </button>
            ) : null}
          </div>
          {replying && viewer ? (
            <div className="mt-2">
              <CommentForm
                postId={postId}
                parentId={comment.parentId ?? comment.id}
                viewer={viewer}
                autoFocus
                placeholder={`Reply to ${comment.author.name}…`}
                onAdded={(reply) => {
                  setReplying(false);
                  onReplyAdded(reply);
                }}
              />
            </div>
          ) : null}
          {comment.replies.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {comment.replies.map((reply) => (
                <CommentRow key={reply.id} comment={reply} postId={postId} viewer={viewer} onReplyAdded={onReplyAdded} onRemoved={onRemoved} isReply />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Threaded comments for a post. Loads on mount unless `initial` is supplied by the server. */
export function Comments({
  postId,
  viewer,
  initial,
  onCountChange,
}: {
  postId: string;
  viewer: CommentViewer;
  initial?: CommentItem[];
  onCountChange?: (delta: number) => void;
}) {
  const [items, setItems] = useState<CommentItem[] | null>(initial ?? null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    loadCommentsAction(postId)
      .then((loaded) => !cancelled && setItems(loaded))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [postId, initial]);

  function addReply(reply: CommentItem) {
    setItems((current) => (current ?? []).map((c) => (c.id === reply.parentId ? { ...c, replies: [...c.replies, reply] } : c)));
    onCountChange?.(1);
  }

  function removeComment(id: string) {
    setItems((current) => {
      const list = current ?? [];
      const root = list.find((c) => c.id === id);
      onCountChange?.(root ? -(1 + root.replies.length) : -1);
      return list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) }));
    });
  }

  return (
    <div className="space-y-4">
      {viewer ? (
        <CommentForm
          postId={postId}
          viewer={viewer}
          onAdded={(comment) => {
            setItems((current) => [...(current ?? []), comment]);
            onCountChange?.(1);
          }}
        />
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to join the discussion.
        </p>
      )}
      {items === null ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-4/5" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-2 text-center text-[13px] text-muted-foreground">No comments yet. Start the discussion.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((comment) => (
            <CommentRow key={comment.id} comment={comment} postId={postId} viewer={viewer} onReplyAdded={addReply} onRemoved={removeComment} />
          ))}
        </ul>
      )}
    </div>
  );
}
