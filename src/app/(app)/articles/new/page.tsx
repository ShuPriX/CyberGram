import { ArticleEditor } from "@/components/feed/article";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Write an article");

export default async function NewArticlePage() {
  await requireOnboardedUser();
  const categories = await getActiveCategories();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Write an article" description="Share a write-up, research or a guide. Articles get their own page and can be found through search." />
      <Card>
        <CardContent>
          <ArticleEditor categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
