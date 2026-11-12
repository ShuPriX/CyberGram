import { asc, eq } from "drizzle-orm";
import { ExternalLink, ListChecks } from "lucide-react";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { events, resources, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { EVENT_TYPE_LABELS, RESOURCE_TYPE_LABELS } from "@/lib/constants";
import { assessLink, leavingHref } from "@/lib/security/link-safety";
import { privateMetadata } from "@/lib/seo";
import { displayHost, formatDate } from "@/lib/utils";
import { reviewSubmissionAction } from "@/server/actions/admin";

export const metadata = privateMetadata("Submissions");

function LinkLine({ url }: { url: string }) {
  const assessment = assessLink(url);
  return (
    <p className="flex flex-wrap items-center gap-2 text-[13px]">
      <a href={leavingHref(url)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline" {...EXTERNAL_LINK_PROPS}>
        <ExternalLink className="size-3.5" aria-hidden="true" /> {displayHost(url)}
      </a>
      {assessment && assessment.level !== "ok" ? <Badge variant={assessment.level === "danger" ? "danger" : "warning"}>{assessment.reasons[0]}</Badge> : null}
    </p>
  );
}

function Decide({ kind, id }: { kind: "event" | "resource"; id: string }) {
  return (
    <div className="flex gap-2 border-t pt-3">
      <ActionButton action={reviewSubmissionAction} input={{ kind, id, decision: "approved" as const }} size="sm">
        Approve
      </ActionButton>
      <ActionButton action={reviewSubmissionAction} input={{ kind, id, decision: "rejected" as const }} variant="outline" size="sm">
        Reject
      </ActionButton>
    </div>
  );
}

export default async function AdminSubmissionsPage() {
  await requireCapability("moderate:submissions");
  const [eventRows, resourceRows] = await Promise.all([
    db.select({ event: events, submitter: users.username }).from(events).leftJoin(users, eq(users.id, events.submittedById)).where(eq(events.status, "pending")).orderBy(asc(events.createdAt)).limit(100),
    db.select({ resource: resources, submitter: users.username }).from(resources).leftJoin(users, eq(users.id, resources.submittedById)).where(eq(resources.status, "pending")).orderBy(asc(resources.createdAt)).limit(100),
  ]);

  return (
    <>
      <PageHeader title="Submissions" description="Events and learning resources suggested by members. Open each link and check it is genuine, relevant and free of affiliate tracking before approving." />
      {eventRows.length === 0 && resourceRows.length === 0 ? (
        <Card>
          <EmptyState icon={ListChecks} title="Nothing to review" />
        </Card>
      ) : null}

      {eventRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Events</h2>
          {eventRows.map(({ event, submitter }) => (
            <Card key={event.id}>
              <CardContent className="space-y-2.5">
                <h3 className="text-[15px] font-semibold">{event.title}</h3>
                <p className="text-[13px] text-muted-foreground">
                  {EVENT_TYPE_LABELS[event.type]} · {formatDate(event.startsAt, "long")}
                  {event.organizer ? ` · ${event.organizer}` : ""}
                  {event.location ? ` · ${event.location}` : ""}
                  {event.isOnline ? " · Online" : ""} · by {submitter ? `@${submitter}` : "a former member"}
                </p>
                <LinkLine url={event.url} />
                {event.description ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{event.description}</p> : null}
                <Decide kind="event" id={event.id} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {resourceRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Learning resources</h2>
          {resourceRows.map(({ resource, submitter }) => (
            <Card key={resource.id}>
              <CardContent className="space-y-2.5">
                <h3 className="text-[15px] font-semibold">{resource.title}</h3>
                <p className="text-[13px] capitalize text-muted-foreground">
                  {RESOURCE_TYPE_LABELS[resource.type]} · {resource.level} · {resource.category} · {resource.isFree ? "free" : "paid"} · by {submitter ? `@${submitter}` : "a former member"}
                </p>
                <LinkLine url={resource.url} />
                {resource.description ? <p className="whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{resource.description}</p> : null}
                <Decide kind="resource" id={resource.id} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </>
  );
}
