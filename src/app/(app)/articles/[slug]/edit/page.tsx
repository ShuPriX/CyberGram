import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/feed/article";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Edit article");

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireOnboardedUser();
  const { slug } = await params;
  // Only the author can load the editor; the save action enforces the same rule again.
  const [article] = await db
    .select({ id: posts.id, title: posts.title, body: posts.body, category: posts.category, type: posts.type, coverFileId: posts.coverFileId })
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.authorId, user.id), eq(posts.status, "published")))
    .limit(1);
  if (!article) notFound();
  const categories = await getActiveCategories();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Edit article" />
      <Card>
        <CardContent>
          <ArticleEditor categories={categories} article={{ ...article, title: article.title ?? "" }} />
        </CardContent>
      </Card>
    </div>
  );
}
