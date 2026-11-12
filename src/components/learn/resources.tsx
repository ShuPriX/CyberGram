import { BadgeCheck, BookOpen, ChevronUp, ExternalLink } from "lucide-react";
import { ChipGroup } from "@/components/shared/fields";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { RESOURCE_LEVELS, RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { cn, displayHost } from "@/lib/utils";
import { toggleResourceVoteAction } from "@/server/actions/community";
import type { ResourceItem } from "@/server/queries/community";

export function ResourceList({ resources, categories, signedIn }: { resources: ResourceItem[]; categories: Record<string, string>; signedIn: boolean }) {
  if (resources.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title="No resources found" description="Try a different filter, or suggest a resource you have found useful." />
      </Card>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {resources.map((resource) => (
        <li key={resource.id} className="flex gap-3 rounded-xl border bg-card p-4">
          <div className="flex shrink-0 flex-col items-center">
            {signedIn ? (
              <ActionButton
                action={toggleResourceVoteAction}
                input={{ resourceId: resource.id }}
                variant={resource.voted ? "soft" : "outline"}
                size="icon-sm"
                aria-pressed={resource.voted}
                aria-label={resource.voted ? "Remove your recommendation" : "Recommend this resource"}
              >
                <ChevronUp />
              </ActionButton>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-md border text-muted-foreground">
                <ChevronUp className="size-4" aria-hidden="true" />
              </span>
            )}
            <span className={cn("mt-1 text-xs font-semibold tabular-nums", resource.voted && "text-primary")} aria-label={`${resource.upvoteCount} recommendations`}>
              {resource.upvoteCount}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold leading-snug">
              <a href={leavingHref(resource.url)} className="hover:text-primary" {...EXTERNAL_LINK_PROPS}>
                {resource.title} <ExternalLink className="mb-0.5 inline size-3 text-subtle" aria-hidden="true" />
              </a>
            </h3>
            <p className="text-xs text-subtle">{displayHost(resource.url)}</p>
            {resource.description ? <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">{resource.description}</p> : null}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <Badge>{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
              <Badge variant="outline" className="capitalize">{resource.level}</Badge>
              <Badge variant="outline">{categories[resource.category] ?? resource.category}</Badge>
              {resource.isFree ? <Badge variant="success">Free</Badge> : <Badge variant="warning">Paid</Badge>}
              {resource.isCurated ? (
                <Badge variant="primary">
                  <BadgeCheck aria-hidden="true" /> Curated
                </Badge>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ResourceFields({ categories }: { categories: { slug: string; name: string }[] }) {
  return (
    <>
      <InputField label="Title" name="title" required maxLength={140} placeholder="PortSwigger Web Security Academy" />
      <InputField label="Link" name="url" type="url" required maxLength={2048} placeholder="https://" />
      <TextareaField label="Why is it useful?" name="description" optional rows={3} maxLength={600} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" name="type" options={RESOURCE_TYPES} defaultValue="course" />
        <SelectField label="Domain" name="category" required placeholder="Select a domain" options={categories.map((c) => ({ value: c.slug, label: c.name }))} />
      </div>
      <ChipGroup legend="Level" name="level" type="radio" options={RESOURCE_LEVELS.map((l) => ({ value: l, label: l[0]!.toUpperCase() + l.slice(1) }))} selected={["beginner"]} />
      <CheckboxField label="This resource is free" name="isFree" defaultChecked hint="Paid resources are allowed but are labelled. Affiliate links are not." />
    </>
  );
}
