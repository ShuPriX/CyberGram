import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Flag } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmptyState, LinkTabs, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { comments, companies, jobs, messages, posts, reports, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { REPORT_REASONS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { truncate } from "@/lib/utils";
import { resolveReportAction, setPostStatusAction } from "@/server/actions/admin";

export const metadata = privateMetadata("Reports");

const REASONS = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));
type Target = { label: string; href?: string; excerpt?: string };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireCapability("moderate:content");
  const { view } = await searchParams;
  const tab = view === "flagged" ? "flagged" : view === "closed" ? "closed" : "open";

  const rows =
    tab === "flagged"
      ? []
      : await db
          .select({ report: reports, reporter: users.username })
          .from(reports)
          .leftJoin(users, eq(users.id, reports.reporterId))
          .where(tab === "open" ? eq(reports.status, "open") : inArray(reports.status, ["resolved", "dismissed"]))
          .orderBy(desc(reports.createdAt))
          .limit(100);

  // Resolve what each report points at, one query per target type.
  const ids = (type: string) => [...new Set(rows.filter((r) => r.report.targetType === type).map((r) => r.report.targetId))];
  const lookup = new Map<string, Target>();
  const [postRows, commentRows, userRows, jobRows, companyRows, messageRows, flagged] = await Promise.all([
    ids("post").length ? db.select({ id: posts.id, body: posts.body, status: posts.status }).from(posts).where(inArray(posts.id, ids("post"))) : [],
    ids("comment").length ? db.select({ id: comments.id, body: comments.body, postId: comments.postId }).from(comments).where(inArray(comments.id, ids("comment"))) : [],
    ids("user").length ? db.select({ id: users.id, username: users.username, name: users.name }).from(users).where(inArray(users.id, ids("user"))) : [],
    ids("job").length ? db.select({ id: jobs.id, slug: jobs.slug, title: jobs.title, companyName: jobs.companyName }).from(jobs).where(inArray(jobs.id, ids("job"))) : [],
    ids("company").length ? db.select({ id: companies.id, slug: companies.slug, name: companies.name }).from(companies).where(inArray(companies.id, ids("company"))) : [],
    ids("message").length ? db.select({ id: messages.id, body: messages.body }).from(messages).where(inArray(messages.id, ids("message"))) : [],
    tab === "flagged"
      ? db
          .select({ id: posts.id, body: posts.body, flaggedReason: posts.flaggedReason, status: posts.status, createdAt: posts.createdAt, author: users.username })
          .from(posts)
          .innerJoin(users, eq(users.id, posts.authorId))
          .where(and(eq(posts.status, "published"), isNotNull(posts.flaggedReason)))
          .orderBy(desc(posts.createdAt))
          .limit(50)
      : [],
  ]);
  for (const p of postRows) lookup.set(`post:${p.id}`, { label: `Post (${p.status})`, href: `/posts/${p.id}`, excerpt: p.body });
  for (const c of commentRows) lookup.set(`comment:${c.id}`, { label: "Comment", href: `/posts/${c.postId}#comment-${c.id}`, excerpt: c.body });
  for (const u of userRows) lookup.set(`user:${u.id}`, { label: `Member: ${u.name}`, href: `/u/${u.username}` });
  for (const j of jobRows) lookup.set(`job:${j.id}`, { label: `Job: ${j.title} at ${j.companyName}`, href: `/jobs/${j.slug}` });
  for (const c of companyRows) lookup.set(`company:${c.id}`, { label: `Organisation: ${c.name}`, href: `/companies/${c.slug}` });
  for (const m of messageRows) lookup.set(`message:${m.id}`, { label: "Direct message", excerpt: m.body });

  return (
    <>
      <PageHeader title="Reports & moderation" description="Member reports and posts flagged by link-safety checks. Reporters are never revealed to the person reported." />
      <LinkTabs
        current={tab}
        items={[
          { value: "open", label: "Open reports", href: "/admin/reports" },
          { value: "flagged", label: "Flagged posts", href: "/admin/reports?view=flagged" },
          { value: "closed", label: "Closed", href: "/admin/reports?view=closed" },
        ]}
      />

      {tab === "flagged" ? (
        flagged.length === 0 ? (
          <Card>
            <EmptyState icon={Flag} title="Nothing flagged" description="Posts containing links that match a risk heuristic appear here for a second look." />
          </Card>
        ) : (
          flagged.map((post) => (
            <Card key={post.id}>
              <CardContent className="space-y-2.5">
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="warning">{post.flaggedReason}</Badge>
                  <Link href={`/u/${post.author}`} className="hover:underline">@{post.author}</Link> · <TimeAgo date={post.createdAt} />
                </p>
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{truncate(post.body, 500)}</p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="xs">
                    <Link href={`/posts/${post.id}`}>Open</Link>
                  </Button>
                  <ActionButton action={setPostStatusAction} input={{ id: post.id, status: "published" as const }} variant="outline" size="xs">
                    Looks fine
                  </ActionButton>
                  <ActionButton action={setPostStatusAction} input={{ id: post.id, status: "removed" as const }} confirm="Remove this post?" variant="destructive-ghost" size="xs">
                    Remove
                  </ActionButton>
                </div>
              </CardContent>
            </Card>
          ))
        )
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Flag} title={tab === "open" ? "No open reports" : "No closed reports"} description={tab === "open" ? "The queue is clear." : undefined} />
        </Card>
      ) : (
        rows.map(({ report, reporter }) => {
          const target = lookup.get(`${report.targetType}:${report.targetId}`);
          return (
            <Card key={report.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="danger">{REASONS[report.reason] ?? report.reason}</Badge>
                  <span>Reported by {reporter ? `@${reporter}` : "a former member"}</span>·<TimeAgo date={report.createdAt} />
                  {report.status !== "open" ? <Badge className="capitalize">{report.status}</Badge> : null}
                </div>
                <p className="text-[14px] font-semibold">
                  {target?.href ? <Link href={target.href} className="hover:text-primary hover:underline">{target.label}</Link> : (target?.label ?? "The reported item no longer exists")}
                </p>
                {target?.excerpt ? <blockquote className="whitespace-pre-line rounded-lg bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed">{truncate(target.excerpt, 400)}</blockquote> : null}
                {report.details ? <p className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground">Reporter’s note:</span> {report.details}</p> : null}
                {report.resolution ? <p className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground">Resolution:</span> {report.resolution}</p> : null}
                {report.status === "open" ? (
                  <ActionForm action={resolveReportAction} refresh className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <input type="hidden" name="id" value={report.id} />
                    <Input name="resolution" maxLength={500} placeholder="Note (shown to the author if content is removed)" aria-label="Resolution note" className="min-w-52 flex-1" />
                    <SubmitButton name="outcome" value="dismiss" variant="outline" size="sm">Dismiss</SubmitButton>
                    <SubmitButton name="outcome" value="resolve" variant="outline" size="sm">Resolve</SubmitButton>
                    {["post", "comment", "message", "job"].includes(report.targetType) ? (
                      <SubmitButton name="outcome" value="remove" variant="destructive" size="sm">Remove content</SubmitButton>
                    ) : null}
                    <FormError className="basis-full" />
                  </ActionForm>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
