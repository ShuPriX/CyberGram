import { BellRing, Trash2 } from "lucide-react";
import Link from "next/link";
import { parseJobFilters } from "@/components/jobs/job-browser";
import { JobsNav, type RawParams } from "@/components/jobs/jobs-nav";
import { ChipGroup } from "@/components/shared/fields";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, Section } from "@/components/ui/card";
import { ActionForm, CheckboxField, FormError, InputField, SelectField, SubmitButton } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { COUNTRIES, countryName, EMPLOYMENT_TYPE_LABELS, EMPLOYMENT_TYPES, EXPERIENCE_LEVEL_LABELS, EXPERIENCE_LEVELS, JOB_CATEGORIES, JOB_CATEGORY_LABELS, type EmploymentType, type ExperienceLevel, type JobCategorySlug } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { timeAgoLong } from "@/lib/utils";
import { saveJobAlertAction, updateJobAlertAction } from "@/server/actions/jobs";
import { listJobAlerts } from "@/server/queries/hiring";

export const metadata = privateMetadata("Job alerts");

export default async function JobAlertsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireUser();
  const [alerts, params] = await Promise.all([listJobAlerts(user.id), searchParams]);
  // Arriving from "Create alert" on the jobs page pre-fills the form with those filters.
  const preset = parseJobFilters(params);
  const presetName = [preset.q, preset.remote ? "Remote" : null, countryName(preset.country), ...(preset.categories ?? []).map((c) => JOB_CATEGORY_LABELS[c as JobCategorySlug])].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title="Job alerts" description="Save a search and we will notify you when new matching roles are published. Alerts only ever contain roles that are open." />
      <JobsNav current="alerts" signedIn />

      {alerts.length === 0 ? (
        <Card>
          <EmptyState icon={BellRing} title="No alerts yet" description="Create one below, or use “Create alert” on the jobs page to save the filters you are using." />
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ul className="divide-y">
              {alerts.map((alert) => {
                const q = alert.query;
                const parts = [
                  q.q ? `“${q.q}”` : null,
                  q.remote ? "Remote" : null,
                  countryName(q.country),
                  ...(q.categories ?? []).map((c) => JOB_CATEGORY_LABELS[c as JobCategorySlug]),
                  ...(q.levels ?? []).map((l) => EXPERIENCE_LEVEL_LABELS[l as ExperienceLevel]),
                  ...(q.types ?? []).map((t) => EMPLOYMENT_TYPE_LABELS[t as EmploymentType]),
                ].filter(Boolean);
                const query = new URLSearchParams();
                if (q.q) query.set("q", q.q);
                if (q.country) query.set("country", q.country);
                if (q.remote) query.set("remote", "1");
                for (const c of q.categories ?? []) query.append("category", c);
                for (const l of q.levels ?? []) query.append("level", l);
                for (const t of q.types ?? []) query.append("type", t);
                return (
                  <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[14px] font-semibold">
                        <Link href={`/jobs?${query}`} className="hover:text-primary">{alert.name}</Link>
                        {alert.active ? <Badge variant="success">Active</Badge> : <Badge>Paused</Badge>}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{parts.length > 0 ? parts.join(" · ") : "All new cybersecurity roles"}</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        {alert.frequency === "daily" ? "Daily" : "Weekly"} · Last checked {alert.lastRunAt ? timeAgoLong(alert.lastRunAt) : "never"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ActionButton action={updateJobAlertAction} input={{ id: alert.id, active: !alert.active }} variant="outline" size="xs">
                        {alert.active ? "Pause" : "Resume"}
                      </ActionButton>
                      <ActionButton action={updateJobAlertAction} input={{ id: alert.id, remove: true }} confirm="Delete this alert?" variant="ghost" size="icon-sm" aria-label="Delete alert" className="text-muted-foreground hover:text-destructive">
                        <Trash2 />
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Section title="Create an alert" description="Leave a filter empty to match everything.">
        <ActionForm action={saveJobAlertAction} refresh resetOnSuccess className="space-y-5">
          <FormError />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Alert name" name="name" required maxLength={80} defaultValue={presetName.slice(0, 80)} placeholder="SOC roles in India" />
            <InputField label="Keywords" name="q" optional maxLength={100} defaultValue={preset.q ?? ""} placeholder="Splunk, detection engineering…" />
            <SelectField label="Country" name="country" optional placeholder="Anywhere" options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} defaultValue={preset.country ?? ""} />
            <SelectField label="Frequency" name="frequency" options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} defaultValue="daily" />
          </div>
          <CheckboxField label="Remote roles only" name="remote" defaultChecked={preset.remote} />
          <ChipGroup legend="Experience level" name="levels" options={EXPERIENCE_LEVELS} selected={preset.levels} />
          <ChipGroup legend="Employment type" name="types" options={EMPLOYMENT_TYPES} selected={preset.types} />
          <ChipGroup legend="Role" name="categories" options={JOB_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))} selected={preset.categories} hint="Up to eight." />
          <div className="flex justify-end border-t pt-4">
            <SubmitButton>Create alert</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}
