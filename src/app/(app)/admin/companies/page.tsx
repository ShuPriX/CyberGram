import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { VerificationBadge } from "@/components/shared/fields";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmptyState, LinkTabs, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { leavingHref } from "@/lib/security/link-safety";
import { COMPANY_TYPE_LABELS } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { reviewCompanyVerificationAction, setCompanyStatusAction } from "@/server/actions/admin";
import { likePattern } from "@/server/queries/jobs";

export const metadata = privateMetadata("Organisations");

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireCapability("verify:companies");
  const params = await searchParams;
  const view = params.view === "all" ? "all" : "pending";
  const q = params.q?.trim().slice(0, 80);
  const where: SQL[] = [];
  if (view === "pending") where.push(eq(companies.verificationStatus, "pending"));
  if (q) where.push(ilike(companies.name, likePattern(q)));

  const rows = await db
    .select({ company: companies, creator: users.username, creatorEmail: users.email })
    .from(companies)
    .leftJoin(users, eq(users.id, companies.createdById))
    .where(and(...where))
    .orderBy(view === "pending" ? asc(companies.verificationRequestedAt) : desc(companies.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader
        title="Organisations"
        description="Verification confirms a page is run by the organisation it names. Check the website, the requester's email domain and the evidence given before deciding."
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LinkTabs
          className="flex-1"
          current={view}
          items={[
            { value: "pending", label: "Verification requests", href: "/admin/companies" },
            { value: "all", label: "All organisations", href: "/admin/companies?view=all" },
          ]}
        />
        {view === "all" ? (
          <form action="/admin/companies" method="get" className="flex gap-2">
            <input type="hidden" name="view" value="all" />
            <Input name="q" type="search" defaultValue={q ?? ""} placeholder="Search by name" aria-label="Search organisations" className="w-56" />
            <Button type="submit" variant="outline">Search</Button>
          </form>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Building2} title={view === "pending" ? "No pending requests" : "No organisations found"} />
        </Card>
      ) : (
        rows.map(({ company, creator, creatorEmail }) => (
          <Card key={company.id}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    <Link href={`/companies/${company.slug}`} className="hover:text-primary">{company.name}</Link>
                    <VerificationBadge status={company.verificationStatus} />
                    {company.status === "suspended" ? <Badge variant="danger">Suspended</Badge> : null}
                    {company.isDemo ? <Badge variant="warning">Demo</Badge> : null}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    {COMPANY_TYPE_LABELS[company.type]}
                    {company.hqLocation ? ` · ${company.hqLocation}` : ""} · created <TimeAgo date={company.createdAt} />
                    {creator ? (
                      <>
                        {" "}by <Link href={`/u/${creator}`} className="hover:underline">@{creator}</Link> ({creatorEmail?.split("@")[1] ?? "—"})
                      </>
                    ) : null}
                  </p>
                </div>
                <ActionButton
                  action={setCompanyStatusAction}
                  input={{ id: company.id, status: company.status === "active" ? ("suspended" as const) : ("active" as const) }}
                  confirm={company.status === "active" ? "Suspend this organisation? Its page is hidden and open listings are closed." : undefined}
                  variant={company.status === "active" ? "destructive-ghost" : "outline"}
                  size="xs"
                >
                  {company.status === "active" ? "Suspend" : "Reactivate"}
                </ActionButton>
              </div>
              {company.website ? (
                <p className="text-[13px]">
                  <span className="text-muted-foreground">Website: </span>
                  <a href={leavingHref(company.website)} className="font-medium text-primary hover:underline" {...EXTERNAL_LINK_PROPS}>{company.website}</a>
                </p>
              ) : (
                <p className="text-[13px] text-warning">No website on the page.</p>
              )}
              {company.verificationEvidence ? (
                <blockquote className="whitespace-pre-line rounded-lg bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed">{company.verificationEvidence}</blockquote>
              ) : null}
              {company.verificationNote ? <p className="text-[13px] text-muted-foreground"><span className="font-medium text-foreground">Last note:</span> {company.verificationNote}</p> : null}
              <ActionForm action={reviewCompanyVerificationAction} refresh className="flex flex-wrap items-center gap-2 border-t pt-3">
                <input type="hidden" name="id" value={company.id} />
                <Input name="note" maxLength={500} placeholder="Note to the organisation (required unless verifying)" aria-label="Decision note" className="min-w-52 flex-1" />
                {company.verificationStatus === "verified" ? (
                  <SubmitButton name="decision" value="revoke" variant="destructive-ghost" size="sm">Revoke verification</SubmitButton>
                ) : (
                  <>
                    <SubmitButton name="decision" value="reject" variant="outline" size="sm">Decline</SubmitButton>
                    <SubmitButton name="decision" value="verify" size="sm">Verify</SubmitButton>
                  </>
                )}
                <FormError className="basis-full" />
              </ActionForm>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
