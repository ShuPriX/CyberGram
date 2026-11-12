import { ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArticleActions } from "@/components/feed/article";
import { Comments } from "@/components/feed/comments";
import { JsonLd } from "@/components/shared/json-ld";
import { Markdown } from "@/components/shared/markdown";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME, POST_TYPE_LABELS } from "@/lib/constants";
import { absoluteUrl, breadcrumbLd, pageMetadata } from "@/lib/seo";
import { excerptOf } from "@/lib/text";
import { formatDate, readingMinutes } from "@/lib/utils";
import { getArticleBySlug, getComments } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug((await params).slug, null);
  if (!article) return { title: "Article", robots: { index: false, follow: false } };
  return pageMetadata({
    title: article.title ?? "Article",
    description: article.excerpt ?? excerptOf(article.body, 200),
    path: `/articles/${article.slug}`,
    type: "article",
    publishedTime: article.createdAt.toISOString(),
    modifiedTime: (article.editedAt ?? article.createdAt).toISOString(),
    authors: [article.author.name],
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const article = await getArticleBySlug(slug, viewer);
  if (!article) notFound();
  const [categories, comments, [extra]] = await Promise.all([
    getCategoryNames(),
    getComments(article.id, viewer),
    db.select({ coverFileId: posts.coverFileId }).from(posts).where(eq(posts.id, article.id)).limit(1),
  ]);
  const path = `/articles/${article.slug}`;

  return (
    <article className="mx-auto w-full max-w-4xl space-y-5">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: article.title,
          description: article.excerpt ?? excerptOf(article.body, 200),
          datePublished: article.createdAt.toISOString(),
          dateModified: (article.editedAt ?? article.createdAt).toISOString(),
          author: { "@type": "Person", name: article.author.name, url: absoluteUrl(`/u/${article.author.username}`) },
          publisher: { "@type": "Organization", name: APP_NAME, url: absoluteUrl("/") },
          mainEntityOfPage: absoluteUrl(path),
          articleSection: categories[article.category] ?? article.category,
          ...(extra?.coverFileId ? { image: absoluteUrl(`/api/files/${extra.coverFileId}`) } : {}),
        }}
      />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Articles", path: "/articles" }, { name: article.title ?? "Article", path }])} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/articles" className="hover:text-foreground">Articles</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href={`/explore/${article.category}`} className="hover:text-foreground">
          {categories[article.category] ?? article.category}
        </Link>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{POST_TYPE_LABELS[article.type]}</Badge>
          <span className="text-xs text-subtle">{readingMinutes(article.body)} min read</span>
        </div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-[28px]">{article.title}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/u/${article.author.username}`} className="group flex items-center gap-3">
            <Avatar name={article.author.name} fileId={article.author.avatarFileId} />
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold group-hover:underline">{article.author.name}</span>
              <span className="block text-xs text-muted-foreground">
                <time dateTime={article.createdAt.toISOString()}>{formatDate(article.createdAt, "long")}</time>
                {article.editedAt ? ` · Updated ${formatDate(article.editedAt)}` : ""}
              </span>
            </span>
          </Link>
          {article.viewer.isAuthor ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${path}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {extra?.coverFileId ? <img src={`/api/files/${extra.coverFileId}`} alt="" className="aspect-[4/1] w-full rounded-xl border object-cover" /> : null}

      <Card>
        <CardContent className="sm:p-8">
          <Markdown>{article.body}</Markdown>
        </CardContent>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <ArticleActions postId={article.id} signedIn={Boolean(user)} initial={{ liked: article.viewer.liked, bookmarked: article.viewer.bookmarked, likeCount: article.likeCount }} />
        </div>
      </Card>

      <section aria-labelledby="discussion" className="space-y-3">
        <h2 id="discussion" className="text-[15px] font-semibold">Discussion</h2>
        <Card>
          <CardContent>
            <Comments postId={article.id} viewer={user ? { name: user.name, avatarFileId: user.avatarFileId } : null} initial={comments} />
          </CardContent>
        </Card>
      </section>
    </article>
  );
}
