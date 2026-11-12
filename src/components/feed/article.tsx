"use client";

import { Bookmark, Heart, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUpload } from "@/components/shared/image-upload";
import { Button } from "@/components/ui/button";
import { ActionForm, FormError, InputField, SelectField, SubmitButton, TextareaField } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { LIMITS } from "@/lib/constants";
import { cn, formatCount } from "@/lib/utils";
import { saveArticleAction, toggleBookmarkAction, toggleLikeAction } from "@/server/actions/posts";

const ARTICLE_TYPES = [
  { value: "article", label: "Technical article" },
  { value: "ctf_writeup", label: "CTF write-up" },
  { value: "research", label: "Security research" },
  { value: "disclosure", label: "Responsible disclosure" },
];

export function ArticleEditor({
  categories,
  article,
}: {
  categories: { slug: string; name: string }[];
  article?: { id: string; title: string; body: string; category: string; type: string; coverFileId: string | null };
}) {
  const router = useRouter();
  return (
    <ActionForm<{ slug: string }> action={saveArticleAction} onSuccess={(data) => data && router.push(`/articles/${data.slug}`)} className="space-y-5">
      <FormError />
      {article ? <input type="hidden" name="id" value={article.id} /> : null}
      <InputField label="Title" name="title" required minLength={8} maxLength={160} defaultValue={article?.title} placeholder="Abusing misconfigured S3 bucket policies: a field guide" />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" name="type" options={ARTICLE_TYPES} defaultValue={article?.type ?? "article"} />
        <SelectField label="Category" name="category" required placeholder="Select a domain" options={categories.map((c) => ({ value: c.slug, label: c.name }))} defaultValue={article?.category ?? ""} />
      </div>
      <ImageUpload name="coverFileId" kind="cover" label="Cover image" shape="wide" initialFileId={article?.coverFileId} hint="Optional. Wide images work best; metadata such as location is stripped on upload." />
      <TextareaField
        label="Body"
        name="body"
        required
        rows={22}
        minLength={200}
        maxLength={LIMITS.articleBody}
        defaultValue={article?.body}
        className="[&_textarea]:font-mono [&_textarea]:text-[13px]"
        hint="Markdown is supported: headings, lists, tables, links and fenced code blocks. Raw HTML is ignored. Only publish findings you are authorised to disclose."
      />
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <SubmitButton>{article ? "Save changes" : "Publish article"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Like, bookmark and share for the article page. */
export function ArticleActions({
  postId,
  signedIn,
  initial,
}: {
  postId: string;
  signedIn: boolean;
  initial: { liked: boolean; bookmarked: boolean; likeCount: number };
}) {
  const [state, setState] = useState(initial);
  const [, startTransition] = useTransition();

  function like() {
    if (!signedIn) return void toast.info("Sign in to like articles.");
    const liked = !state.liked;
    setState((s) => ({ ...s, liked, likeCount: s.likeCount + (liked ? 1 : -1) }));
    startTransition(async () => {
      const result = await toggleLikeAction({ id: postId });
      if (!result?.ok) setState((s) => ({ ...s, liked: !liked, likeCount: s.likeCount + (liked ? -1 : 1) }));
    });
  }

  function bookmark() {
    if (!signedIn) return void toast.info("Sign in to save articles.");
    const bookmarked = !state.bookmarked;
    setState((s) => ({ ...s, bookmarked }));
    startTransition(async () => {
      const result = await toggleBookmarkAction({ id: postId });
      if (!result?.ok) setState((s) => ({ ...s, bookmarked: !bookmarked }));
    });
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ url, title: document.title });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied.");
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={like} aria-pressed={state.liked} className={cn(state.liked && "text-primary")}>
        <Heart className={cn(state.liked && "fill-current")} /> {state.likeCount > 0 ? formatCount(state.likeCount) : "Like"}
      </Button>
      <Button variant="ghost" size="sm" onClick={bookmark} aria-pressed={state.bookmarked} className={cn(state.bookmarked && "text-primary")}>
        <Bookmark className={cn(state.bookmarked && "fill-current")} /> {state.bookmarked ? "Saved" : "Save"}
      </Button>
      <Button variant="ghost" size="sm" onClick={share}>
        <Share2 /> Share
      </Button>
    </div>
  );
}
