import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CompanyJobForm } from "@/components/recruiter/job-form";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getCompanyAccess } from "@/server/services/access";

export const metadata = privateMetadata("Edit listing");

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/.test(id)) notFound();
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.source, "direct"))).limit(1);
  if (!job?.companyId) notFound();
  const access = await getCompanyAccess(user.id, { id: job.companyId });
  if (!access || job.status === "rejected") notFound();
  const { company } = access;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Edit listing" description={job.title} />
      <CompanyJobForm company={{ id: company.id, name: company.name, verified: company.verificationStatus === "verified" }} job={job} />
    </div>
  );
}
