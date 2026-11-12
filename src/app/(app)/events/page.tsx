import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EventFields, EventList } from "@/components/learn/events";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { LinkTabs, PageHeader } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { EVENT_TYPES } from "@/lib/constants";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { submitEventAction } from "@/server/actions/community";
import { listUpcomingEvents } from "@/server/queries/community";

export const metadata: Metadata = pageMetadata({
  title: "Cybersecurity Conferences, CTFs and Events",
  description: "Upcoming cybersecurity conferences, capture-the-flag competitions, training and meetups, submitted by the community and checked by moderators.",
  path: "/events",
});

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const selected = EVENT_TYPES.find((t) => t.value === type)?.value;
  const [user, events] = await Promise.all([getCurrentUser(), listUpcomingEvents({ type: selected })]);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }])} />
      <PageHeader
        title="Events"
        description="Conferences, CTFs, competitions and training. Listings link to the organiser's own page — always register there."
        action={
          user ? (
            <EntryDialog trigger={<><Plus /> Submit an event</>} variant="default" title="Submit an event" description="A moderator checks the link before the event is listed." action={submitEventAction} submitLabel="Submit" size="lg">
              <EventFields />
            </EntryDialog>
          ) : (
            <Button asChild>
              <Link href="/login?next=/events">Sign in to submit</Link>
            </Button>
          )
        }
      />
      <LinkTabs
        current={selected ?? "all"}
        items={[{ value: "all", label: "All", href: "/events" }, ...EVENT_TYPES.map((t) => ({ value: t.value, label: t.label, href: `/events?type=${t.value}` }))]}
      />
      <EventList events={events} />
    </div>
  );
}
