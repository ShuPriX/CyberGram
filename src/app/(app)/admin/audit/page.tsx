import { and, desc, eq, ilike, lt, type SQL } from "drizzle-orm";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, Pager } from "@/components/ui/misc";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { likePattern } from "@/server/queries/jobs";

export const metadata = privateMetadata("Audit log");

const PAGE_SIZE = 60;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; actor?: string; before?: string }> }) {
  await requireCapability("view:audit");
  const params = await searchParams;
  const action = params.action?.trim().slice(0, 60);
  const actor = params.actor?.trim().toLowerCase().replace(/^@/, "").slice(0, 30);
  const beforeMs = Number(params.before);
  const before = Number.isFinite(beforeMs) && beforeMs > 0 ? new Date(beforeMs) : undefined;

  const where: SQL[] = [];
  if (action) where.push(ilike(auditLogs.action, likePattern(action)));
  if (actor) where.push(eq(users.username, actor));
  if (before) where.push(lt(auditLogs.createdAt, before));
  const rows = await db
    .select({ entry: auditLogs, actor: users.username })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(and(...where))
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE_SIZE + 1);
  const shown = rows.slice(0, PAGE_SIZE);
  const last = shown.at(-1);
  const link = (cursor?: number) => {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (actor) query.set("actor", actor);
    if (cursor) query.set("before", String(cursor));
    const text = query.toString();
    return text ? `/admin/audit?${text}` : "/admin/audit";
  };

  return (
    <>
      <PageHeader title="Audit log" description="An append-only record of sign-ins, security changes, moderation decisions and administrative actions. Entries cannot be edited or deleted from the application." />
      <form action="/admin/audit" method="get" className="flex flex-wrap gap-3 rounded-xl border bg-card p-4 shadow-card">
        <Input name="action" defaultValue={action ?? ""} maxLength={60} placeholder="Action contains… e.g. auth. or admin.job" aria-label="Action" className="min-w-52 flex-1" />
        <Input name="actor" defaultValue={actor ?? ""} maxLength={30} placeholder="Actor handle" aria-label="Actor handle" className="w-48" />
        <Button type="submit">Filter</Button>
        {action || actor ? (
          <Button asChild variant="ghost">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        ) : null}
      </form>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title="No matching entries" />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">When (UTC)</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Actor</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Target</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Details</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map(({ entry, actor: handle }) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(entry.createdAt, "dateTime")}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{entry.action}</td>
                  <td className="px-3 py-2.5">{handle ? <Link href={`/u/${handle}`} className="hover:underline">@{handle}</Link> : <span className="text-subtle">system</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{entry.targetType ? `${entry.targetType} ${entry.targetId?.slice(0, 10) ?? ""}` : "—"}</td>
                  <td className="max-w-64 break-words px-3 py-2.5 font-mono text-[11px] text-muted-foreground">{entry.metadata ? JSON.stringify(entry.metadata).slice(0, 160) : ""}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{entry.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Pager prevHref={before ? link() : null} nextHref={rows.length > PAGE_SIZE && last ? link(last.entry.createdAt.getTime()) : null} />
    </>
  );
}
