import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, Section } from "@/components/ui/card";
import { PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { auditLogs, companies, jobApplications, jobSyncRuns, jobSources, jobs, posts, users } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { requireCapability } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { formatCount } from "@/lib/utils";
import { openJobCondition } from "@/server/queries/jobs";

export const metadata = privateMetadata("Admin");

const DAY = 24 * 60 * 60 * 1000;
/** Kept outside the component: reading the clock is not allowed during render. */
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const value = async (query: Promise<{ value: number }[]>) => (await query)[0]?.value ?? 0;

function Stat({ label, value: amount, hint, href }: { label: string; value: number; hint?: string; href?: string }) {
  const body = (
    <CardContent className="py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatCount(amount)}</p>
      {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
    </CardContent>
  );
  return <Card className={href ? "transition-colors hover:border-border-strong" : undefined}>{href ? <Link href={href}>{body}</Link> : body}</Card>;
}

export default async function AdminOverviewPage() {
  const user = await requireCapability("admin:access");
  const week = daysAgo(7);
  const showAnalytics = can(user.role, "view:analytics");

  const [members, newMembers, activeJobs, newJobs, importedJobs, applications, postsWeek, companyCount, signups, lastRuns, recent] = await Promise.all([
    value(db.select({ value: count() }).from(users).where(eq(users.status, "active"))),
    value(db.select({ value: count() }).from(users).where(gte(users.createdAt, week))),
    value(db.select({ value: count() }).from(jobs).where(openJobCondition())),
    value(db.select({ value: count() }).from(jobs).where(gte(jobs.createdAt, week))),
    value(db.select({ value: count() }).from(jobs).where(and(openJobCondition(), eq(jobs.source, "imported")))),
    value(db.select({ value: count() }).from(jobApplications).where(gte(jobApplications.createdAt, week))),
    value(db.select({ value: count() }).from(posts).where(and(gte(posts.createdAt, week), eq(posts.status, "published")))),
    value(db.select({ value: count() }).from(companies).where(eq(companies.status, "active"))),
    showAnalytics
      ? db
          .select({ day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`, value: count() })
          .from(users)
          .where(gte(users.createdAt, daysAgo(14)))
          .groupBy(sql`date_trunc('day', ${users.createdAt})`)
          .orderBy(sql`date_trunc('day', ${users.createdAt})`)
      : [],
    can(user.role, "manage:sources")
      ? db
          .select({ id: jobSyncRuns.id, name: jobSources.name, status: jobSyncRuns.status, startedAt: jobSyncRuns.startedAt, created: jobSyncRuns.created, expired: jobSyncRuns.expired, error: jobSyncRuns.error })
          .from(jobSyncRuns)
          .innerJoin(jobSources, eq(jobSources.id, jobSyncRuns.sourceId))
          .orderBy(desc(jobSyncRuns.startedAt))
          .limit(6)
      : [],
    can(user.role, "view:audit")
      ? db
          .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actor: users.username })
          .from(auditLogs)
          .leftJoin(users, eq(users.id, auditLogs.actorId))
          .orderBy(desc(auditLogs.createdAt))
          .limit(8)
      : [],
  ]);
  const peak = Math.max(1, ...signups.map((s) => s.value));

  return (
    <>
      <PageHeader title="Overview" description="Platform health at a glance. Queues that need attention are flagged in the navigation." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active members" value={members} hint={`+${newMembers} this week`} href={can(user.role, "manage:users") ? "/admin/users" : undefined} />
        <Stat label="Open job listings" value={activeJobs} hint={`${importedJobs} imported · ${newJobs} added this week`} href="/jobs" />
        <Stat label="Applications this week" value={applications} />
        <Stat label="Posts this week" value={postsWeek} hint={`${companyCount} organisations`} />
      </div>

      {showAnalytics ? (
        <Section title="New members" description="Sign-ups per day over the last two weeks.">
          {signups.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No sign-ups in this period.</p>
          ) : (
            <ol className="flex h-32 items-end gap-1.5" aria-label="Sign-ups per day">
              {signups.map((day) => (
                <li key={day.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${day.day}: ${day.value}`}>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{day.value}</span>
                  <span className="w-full rounded-t bg-primary" style={{ height: `${Math.max(4, (day.value / peak) * 100)}%` }} />
                  <span className="text-[10px] text-subtle">{day.day.slice(8)}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      ) : null}

      {lastRuns.length > 0 ? (
        <Section title="Recent job synchronisation" action={<Link href="/admin/sources" className="text-[13px] font-medium text-primary hover:underline">Manage sources</Link>}>
          <ul className="divide-y text-[13px]">
            {lastRuns.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="flex items-center gap-2">
                  <Badge variant={run.status === "success" ? "success" : run.status === "failed" ? "danger" : "warning"} className="capitalize">{run.status}</Badge>
                  <span className="font-medium">{run.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {run.error ? run.error.slice(0, 80) : `${run.created} new · ${run.expired} closed`} · <TimeAgo date={run.startedAt} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section title="Latest audit events" action={<Link href="/admin/audit" className="text-[13px] font-medium text-primary hover:underline">Full log</Link>}>
          <ul className="divide-y text-[13px]">
            {recent.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 py-2 first:pt-0 last:pb-0">
                <span className="font-mono text-xs">{entry.action}</span>
                <span className="text-xs text-muted-foreground">
                  {entry.actor ? `@${entry.actor}` : "system"} · <TimeAgo date={entry.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
