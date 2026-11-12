import { BadgeCheck, Building2, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { RecruiterJobTable } from "@/components/recruiter/job-table";
import { VerificationBadge } from "@/components/shared/fields";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import type { VerificationStatus } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { pluralize } from "@/lib/utils";
import { getMemberCompanies } from "@/server/queries/companies";
import { listCompanyJobs } from "@/server/queries/hiring";

export const metadata = privateMetadata("Recruiter portal");

export default async function RecruiterPage() {
  const user = await requireOnboardedUser();
  const companies = await getMemberCompanies(user.id);
  const jobs = await listCompanyJobs(companies.map((c) => c.id));
  const names = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const hasVerified = companies.some((c) => c.verificationStatus === "verified" && c.status === "active");

  if (companies.length === 0) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader title="Recruiter portal" description="Publish cybersecurity roles, review applicants and build your organisation's presence." />
        <Card>
          <EmptyState
            icon={Building2}
            title="Start by adding your organisation"
            description="Create a page for the company or security team you hire for. You can then post jobs, invite colleagues and request verification."
            action={
              <>
                <Button asChild>
                  <Link href="/companies/new">
                    <Plus /> Add your organisation
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/jobs/submit">Share a job you found instead</Link>
                </Button>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruiter portal"
        description="Your organisations, listings and applicants."
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/recruiter/candidates">
                <Search /> Find candidates
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/companies/new">
                <Plus /> New organisation
              </Link>
            </Button>
          </>
        }
      />

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <li key={company.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={company.name} fileId={company.logoFileId} shape="square" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/recruiter/${company.slug}`} className="flex items-center gap-1 text-[14.5px] font-semibold hover:text-primary">
                      <span className="truncate">{company.name}</span>
                      {company.verificationStatus === "verified" ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified" /> : null}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">
                      {company.role} · {pluralize(company.openJobs, "open role")}
                    </p>
                  </div>
                </div>
                <VerificationBadge status={company.verificationStatus as VerificationStatus} className="self-start" />
                {company.status !== "active" ? <p className="text-xs text-destructive">This organisation is suspended.</p> : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" disabled={company.status !== "active"}>
                    <Link href={`/recruiter/${company.slug}/jobs/new`}>
                      <Plus /> Post a job
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/recruiter/${company.slug}`}>Manage</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {!hasVerified ? (
        <p className="rounded-lg border bg-muted px-3.5 py-3 text-[13px] text-muted-foreground">
          <Users className="mr-1.5 inline size-4 -translate-y-px" aria-hidden="true" />
          Listings from unverified organisations are reviewed before going live, and candidate discovery is limited to verified organisations. Request verification from your
          organisation’s Manage page.
        </p>
      ) : null}

      <section aria-labelledby="listings" className="space-y-3">
        <h2 id="listings" className="text-[15px] font-semibold">Your listings</h2>
        <RecruiterJobTable jobs={jobs} companyNames={companies.length > 1 ? names : undefined} />
      </section>
    </div>
  );
}
