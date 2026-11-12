import { desc, eq, sql } from "drizzle-orm";
import { Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, Section } from "@/components/ui/card";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/form";
import { EmptyState, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { companies, jobSources, jobSyncRuns, jobs } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { JOB_SOURCE_KINDS, SOURCE_AUTHORIZATION_BASES } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { deleteJobSourceAction, runScheduledWorkAction, saveJobSourceAction, syncSourceNowAction } from "@/server/actions/admin";
import { openJobCondition } from "@/server/queries/jobs";

export const metadata = privateMetadata("Job sources");

type Source = typeof jobSources.$inferSelect;
const KIND = Object.fromEntries(JOB_SOURCE_KINDS.map((k) => [k.value, k]));
const BASIS = Object.fromEntries(SOURCE_AUTHORIZATION_BASES.map((b) => [b.value, b.label]));

function SourceFields({ source, companySlug }: { source?: Source; companySlug?: string | null }) {
  return (
    <>
      {source ? <input type="hidden" name="id" value={source.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Source name" name="name" required maxLength={100} defaultValue={source?.name} placeholder="Acme careers" />
        <SelectField label="Type" name="kind" options={JOB_SOURCE_KINDS.map((k) => ({ value: k.value, label: k.label }))} defaultValue={source?.kind ?? "greenhouse"} />
      </div>
      <InputField
        label="Board token or feed URL"
        name="target"
        required
        maxLength={500}
        defaultValue={source?.target}
        hint="For Greenhouse, Lever and Ashby: the board identifier only (the last segment of the public board URL). For JSON and RSS feeds: the full https:// URL."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Company name" name="companyName" required maxLength={120} defaultValue={source?.companyName} hint="Shown on every listing from this source." />
        <InputField label="Organisation page slug" name="companySlug" optional maxLength={80} defaultValue={companySlug ?? ""} hint="Links listings to the organisation's page here, if it has one." />
      </div>
      <SelectField label="Why we may list from this source" name="authorizationBasis" options={SOURCE_AUTHORIZATION_BASES} defaultValue={source?.authorizationBasis ?? "public_api_terms"} />
      <TextareaField
        label="Authorisation details"
        name="authorizationNote"
        required
        rows={3}
        minLength={10}
        maxLength={1000}
        defaultValue={source?.authorizationNote ?? ""}
        hint="Who approved it, the agreement, or the terms that permit it. Sources are never added without a recorded basis; sites that prohibit automated collection must not be added."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Sync every (hours)" name="intervalHours" type="number" min={1} max={168} defaultValue={source?.intervalHours ?? 24} />
      </div>
      <CheckboxField label="Enabled" name="enabled" defaultChecked={source?.enabled ?? true} />
      <CheckboxField label="Only import security-related roles" name="securityOnly" defaultChecked={source?.securityOnly ?? true} hint="Recommended for company-wide boards that list every department." />
      <CheckboxField label="Publish new listings automatically" name="autoPublish" defaultChecked={source?.autoPublish ?? false} hint="When off, imported listings wait in the review queue. Listings that match a scam pattern are always held." />
    </>
  );
}

export default async function AdminSourcesPage() {
  await requireCapability("manage:sources");
  const [sources, runs] = await Promise.all([
    db
      .select({
        source: jobSources,
        companySlug: companies.slug,
        open: sql<number>`(select count(*)::int from ${jobs} where ${jobs.sourceId} = ${jobSources.id} and ${openJobCondition()})`,
        pending: sql<number>`(select count(*)::int from ${jobs} where ${jobs.sourceId} = ${jobSources.id} and ${jobs.status} = 'pending_review')`,
      })
      .from(jobSources)
      .leftJoin(companies, eq(companies.id, jobSources.companyId))
      .orderBy(jobSources.name),
    db
      .select({ run: jobSyncRuns, name: jobSources.name })
      .from(jobSyncRuns)
      .innerJoin(jobSources, eq(jobSources.id, jobSyncRuns.sourceId))
      .orderBy(desc(jobSyncRuns.startedAt))
      .limit(25),
  ]);

  return (
    <>
      <PageHeader
        title="Job sources"
        description="Authorised feeds that listings are synchronised from. Each sync adds new roles, refreshes existing ones and closes roles that have disappeared from the source."
        action={
          <>
            <ActionButton action={runScheduledWorkAction} input={{}} variant="outline" size="sm">
              <Play /> Run daily job now
            </ActionButton>
            <EntryDialog trigger={<><Plus /> Add source</>} variant="default" title="Add a job source" action={saveJobSourceAction} size="lg">
              <SourceFields />
            </EntryDialog>
          </>
        }
      />

      {sources.length === 0 ? (
        <Card>
          <EmptyState
            icon={RefreshCw}
            title="No sources configured"
            description="Add an employer's public job board (Greenhouse, Lever, Ashby) or a JSON/RSS feed you are authorised to use. Until then, the hub lists roles posted directly by companies and approved community submissions."
          />
        </Card>
      ) : (
        sources.map(({ source, companySlug, open, pending }) => (
          <Card key={source.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {source.name}
                    {source.enabled ? <Badge variant="success">Enabled</Badge> : <Badge>Disabled</Badge>}
                    {source.lastStatus ? (
                      <Badge variant={source.lastStatus === "success" ? "success" : source.lastStatus === "failed" ? "danger" : "warning"} className="capitalize">
                        Last sync: {source.lastStatus}
                      </Badge>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 break-all text-[13px] text-muted-foreground">
                    {KIND[source.kind]?.label} · <span className="font-mono text-xs">{source.target}</span> · {source.companyName}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <ActionButton action={syncSourceNowAction} input={{ id: source.id }} variant="outline" size="xs">
                    <RefreshCw /> Sync now
                  </ActionButton>
                  <EntryDialog trigger={<Pencil />} aria-label="Edit source" variant="ghost" buttonSize="icon-sm" title="Edit job source" action={saveJobSourceAction} size="lg">
                    <SourceFields source={source} companySlug={companySlug} />
                  </EntryDialog>
                  <ActionButton
                    action={deleteJobSourceAction}
                    input={{ id: source.id }}
                    confirm="Remove this source? Its open listings will be closed."
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove source"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </ActionButton>
                </div>
              </div>
              <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="inline text-muted-foreground">Open listings: </dt><dd className="inline font-medium">{open}</dd></div>
                <div><dt className="inline text-muted-foreground">Awaiting review: </dt><dd className="inline font-medium">{pending}</dd></div>
                <div><dt className="inline text-muted-foreground">Last sync: </dt><dd className="inline font-medium">{source.lastSyncAt ? <TimeAgo date={source.lastSyncAt} /> : "never"}</dd></div>
                <div><dt className="inline text-muted-foreground">Next: </dt><dd className="inline font-medium">{source.nextSyncAt ? formatDate(source.nextSyncAt, "dateTime") : "on next run"}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{BASIS[source.authorizationBasis]}.</span> {source.authorizationNote}
              </p>
              {source.lastError ? <p className="rounded-md bg-destructive-soft px-3 py-2 text-xs text-destructive-soft-foreground">{source.lastError}</p> : null}
            </CardContent>
          </Card>
        ))
      )}

      {runs.length > 0 ? (
        <Section title="Synchronisation history">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-[13px]">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-medium">Source</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Fetched</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">New</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Updated</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Closed</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Skipped</th>
                  <th scope="col" className="py-2 pl-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map(({ run, name }) => (
                  <tr key={run.id}>
                    <td className="py-2 pr-3 font-medium">{name}</td>
                    <td className="px-3 py-2">
                      <Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "danger" : "warning"} className="capitalize">{run.status}</Badge>
                      <span className="ml-1.5 text-xs text-subtle">{run.trigger}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{run.fetched}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{run.created}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{run.updated}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{run.expired}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{run.skipped + run.duplicates}</td>
                    <td className="py-2 pl-3 text-muted-foreground"><TimeAgo date={run.startedAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </>
  );
}
