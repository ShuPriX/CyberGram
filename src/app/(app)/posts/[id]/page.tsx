import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { getCurrentUser } from "@/lib/auth/session";
import { pageMetadata } from "@/lib/seo";
import { excerptOf } from "@/lib/text";
import { getPost } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Metadata is built for an anonymous reader, so non-public posts never leak into previews.
  const post = await getPost((await params).id, null);
  if (!post) return { title: "Post", robots: { index: false, follow: false } };
  const subject = post.isRepost && !post.body && post.repostOf ? post.repostOf : post;
  return pageMetadata({
    title: subject.title ?? `${subject.author.name}: “${excerptOf(subject.body, 60)}”`,
    description: excerptOf(subject.body, 200),
    path: `/posts/${post.id}`,
    type: "article",
    publishedTime: post.createdAt.toISOString(),
    authors: [subject.author.name],
    // Short updates are thin content; long-form articles have their own indexable pages.
    noindex: subject.body.length < 400,
  });
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const post = await getPost(id, user ? { id: user.id, role: user.role } : null);
  if (!post) notFound();
  if (post.slug) redirect(`/articles/${post.slug}`);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Link href={user ? "/feed" : "/explore"} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {user ? "Back to feed" : "Explore more"}
      </Link>
      <h1 className="sr-only">Post by {post.author.name}</h1>
      <PostCard post={post} detail context={{ viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories: await getCategoryNames() }} />
    </div>
  );
}
