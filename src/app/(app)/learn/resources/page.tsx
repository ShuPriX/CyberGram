import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { one, type RawParams } from "@/components/jobs/jobs-nav";
import { ResourceFields, ResourceList } from "@/components/learn/resources";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { RESOURCE_LEVELS, RESOURCE_TYPES } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";
import { submitResourceAction } from "@/server/actions/community";
import { listResources } from "@/server/queries/community";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Free Cybersecurity Learning Resources",
  description: "Free labs, courses, guides, tools and write-ups for learning cybersecurity, recommended by practitioners and filterable by domain and level.",
  path: "/learn/resources",
});

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const [user, categories] = await Promise.all([getCurrentUser(), getActiveCategories()]);
  const filters = {
    q: one(params.q),
    category: categories.find((c) => c.slug === one(params.domain))?.slug,
    type: RESOURCE_TYPES.find((t) => t.value === one(params.type))?.value,
    level: RESOURCE_LEVELS.find((l) => l === one(params.level)),
  };
  const resources = await listResources(filters, user?.id ?? null);
  const filtered = Boolean(filters.q || filters.category || filters.type || filters.level);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link href="/learn" className="hover:text-foreground">Learn</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page">Resources</span>
      </nav>
      <PageHeader
        title="Learning resources"
        description="Ranked by member recommendations. Curated entries were added by the platform team; the rest were suggested by members and reviewed before listing."
        action={
          user ? (
            <EntryDialog trigger={<><Plus /> Suggest a resource</>} variant="default" title="Suggest a resource" description="A moderator reviews suggestions before they are listed." action={submitResourceAction} submitLabel="Submit">
              <ResourceFields categories={categories} />
            </EntryDialog>
          ) : (
            <Button asChild>
              <Link href="/login?next=/learn/resources">Sign in to suggest</Link>
            </Button>
          )
        }
      />
      <form action="/learn/resources" method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <Input name="q" type="search" defaultValue={filters.q ?? ""} maxLength={80} placeholder="Search resources" aria-label="Search resources" />
        <Select name="domain" defaultValue={filters.category ?? ""} aria-label="Domain">
          <option value="">Any domain</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={filters.type ?? ""} aria-label="Type">
          <option value="">Any type</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Select name="level" defaultValue={filters.level ?? ""} aria-label="Level">
          <option value="">Any level</option>
          {RESOURCE_LEVELS.map((l) => (
            <option key={l} value={l} className="capitalize">{l[0]!.toUpperCase() + l.slice(1)}</option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit">Filter</Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/learn/resources">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>
      <ResourceList resources={resources} categories={Object.fromEntries(categories.map((c) => [c.slug, c.name]))} signedIn={Boolean(user)} />
    </div>
  );
}
