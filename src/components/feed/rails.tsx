import { ArrowRight, Hash } from "lucide-react";
import Link from "next/link";
import { FollowButton, PersonRow } from "@/components/people/person";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { TimeAgo } from "@/components/ui/misc";
import { formatCount } from "@/lib/utils";
import { listJobs } from "@/server/queries/jobs";
import { getSuggestedPeople } from "@/server/queries/people";
import { getTrendingTags } from "@/server/queries/posts";

function RailCard({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-[13px] uppercase tracking-wider text-subtle">{title}</CardTitle>
          {href ? (
            <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {hrefLabel ?? "See all"} <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export async function TrendingTagsCard() {
  const tags = await getTrendingTags(8);
  if (tags.length === 0) return null;
  return (
    <RailCard title="Trending topics" href="/explore">
      <ul className="space-y-2">
        {tags.map((tag) => (
          <li key={tag.tag}>
            <Link href={`/explore/tag/${tag.tag}`} className="group flex items-center gap-2 text-[13px]">
              <Hash className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">{tag.tag}</span>
              <span className="shrink-0 text-xs text-subtle">{formatCount(tag.posts)} posts</span>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

export async function SuggestedPeopleCard({ viewerId }: { viewerId: string }) {
  const people = await getSuggestedPeople(viewerId, 4);
  if (people.length === 0) return null;
  return (
    <RailCard title="People to follow" href="/network?tab=discover">
      <ul className="space-y-3.5">
        {people.map((person) => (
          <li key={person.id}>
            <PersonRow person={{ ...person, location: null }} action={<FollowButton userId={person.id} following={false} size="xs" />} />
          </li>
        ))}
      </ul>
    </RailCard>
  );
}

export async function LatestJobsCard({ viewerId }: { viewerId?: string | null }) {
  const { items } = await listJobs({ pageSize: 4, prioritizeEarlyCareer: true, viewerId });
  if (items.length === 0) return null;
  return (
    <RailCard title="Latest opportunities" href="/jobs" hrefLabel="All jobs">
      <ul className="space-y-3">
        {items.map((job) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.slug}`} className="group block">
              <span className="line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-primary">{job.title}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {job.companyName} · <TimeAgo date={job.postedAt} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
