import { asc } from "drizzle-orm";
import { Pencil, Plus } from "lucide-react";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckboxField, InputField, TextareaField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { saveCategoryAction } from "@/server/actions/admin";
import { getCategoryPostCounts } from "@/server/queries/posts";

export const metadata = privateMetadata("Categories");

type Category = typeof categories.$inferSelect;

function CategoryFields({ category }: { category?: Category }) {
  return (
    <>
      {category ? <input type="hidden" name="slug" value={category.slug} /> : <input type="hidden" name="isNew" value="true" />}
      <InputField label="Name" name="name" required maxLength={60} defaultValue={category?.name} hint={category ? `URL: /explore/${category.slug} (fixed)` : "The URL is derived from the name and cannot be changed later."} />
      <TextareaField label="Description" name="description" optional rows={3} maxLength={300} defaultValue={category?.description ?? ""} hint="Shown on the Explore page and used as the page's meta description." />
      <InputField label="Position" name="position" type="number" min={0} max={999} defaultValue={category?.position ?? 50} hint="Lower numbers appear first." />
      <CheckboxField label="Active" name="active" defaultChecked={category?.active ?? true} hint="Inactive categories are hidden from pickers and Explore. Existing posts keep their category." />
    </>
  );
}

export default async function AdminCategoriesPage() {
  await requireCapability("manage:categories");
  const [rows, counts] = await Promise.all([db.select().from(categories).orderBy(asc(categories.position), asc(categories.name)), getCategoryPostCounts()]);

  return (
    <>
      <PageHeader
        title="Categories"
        description="The security domains used to organise posts, articles, communities and profiles."
        action={
          <EntryDialog trigger={<><Plus /> Add category</>} variant="default" title="Add a category" action={saveCategoryAction} size="sm">
            <CategoryFields />
          </EntryDialog>
        }
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Posts</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Position</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((category) => (
              <tr key={category.slug}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{category.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{category.description}</p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{counts[category.slug] ?? 0}</td>
                <td className="px-3 py-3 text-right tabular-nums">{category.position}</td>
                <td className="px-3 py-3">{category.active ? <Badge variant="success">Active</Badge> : <Badge>Hidden</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <EntryDialog trigger={<Pencil />} aria-label={`Edit ${category.name}`} variant="ghost" buttonSize="icon-sm" title={`Edit ${category.name}`} action={saveCategoryAction} size="sm">
                    <CategoryFields category={category} />
                  </EntryDialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
