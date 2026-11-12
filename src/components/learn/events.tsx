import { CalendarDays, ExternalLink, MapPin, Video } from "lucide-react";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import type { events } from "@/db/schema";
import { COUNTRIES, countryName, EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { formatDate } from "@/lib/utils";

type EventRow = typeof events.$inferSelect;

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

export function EventList({ events: items }: { events: EventRow[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="No upcoming events listed" description="Know of a conference, CTF or training? Submit it and a moderator will add it." />
      </Card>
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {items.map((event) => {
        const place = [event.location, countryName(event.country)].filter(Boolean).join(", ");
        const range = event.endsAt && formatDate(event.endsAt) !== formatDate(event.startsAt) ? `${formatDate(event.startsAt)} – ${formatDate(event.endsAt)}` : formatDate(event.startsAt, "long");
        return (
          <li key={event.id} className="flex gap-4 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted" aria-hidden="true">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{MONTH.format(event.startsAt)}</span>
              <span className="text-lg font-semibold leading-none">{event.startsAt.getUTCDate()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold leading-snug">
                <a href={leavingHref(event.url)} className="hover:text-primary" {...EXTERNAL_LINK_PROPS}>
                  {event.title} <ExternalLink className="mb-0.5 inline size-3 text-subtle" aria-hidden="true" />
                </a>
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {range}
                {event.organizer ? ` · ${event.organizer}` : ""}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {event.isOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <Video className="size-3.5" aria-hidden="true" /> Online
                  </span>
                ) : null}
                {place ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" /> {place}
                  </span>
                ) : null}
              </p>
              {event.description ? <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{event.description}</p> : null}
              <Badge className="mt-2">{EVENT_TYPE_LABELS[event.type]}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EventFields() {
  return (
    <>
      <InputField label="Event name" name="title" required maxLength={140} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Type" name="type" options={EVENT_TYPES} defaultValue="conference" />
        <InputField label="Organiser" name="organizer" optional maxLength={120} />
      </div>
      <InputField label="Official link" name="url" type="url" required maxLength={2048} placeholder="https://" hint="The organiser's own page, where people can register." />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Starts" name="startsAt" type="date" required />
        <InputField label="Ends" name="endsAt" type="date" optional />
        <InputField label="City / venue" name="location" optional maxLength={120} />
        <SelectField label="Country" name="country" optional placeholder="Not applicable" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
      </div>
      <CheckboxField label="This event can be attended online" name="isOnline" />
      <TextareaField label="Description" name="description" optional rows={3} maxLength={1500} />
    </>
  );
}
