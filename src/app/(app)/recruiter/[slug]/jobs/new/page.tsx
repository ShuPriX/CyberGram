import { notFound, redirect } from "next/navigation";
import { CompanyJobForm } from "@/components/recruiter/job-form";
import { PageHeader } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getCompanyAccess } from "@/server/services/access";

export const metadata = privateMetadata("Post a job");

export default async function NewJobPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireOnboardedUser();
  const access = await getCompanyAccess(user.id, { slug: (await params).slug });
  if (!access) notFound();
  if (access.company.status !== "active") redirect(`/recruiter/${access.company.slug}`);
  const { company } = access;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title={`Post a job at ${company.name}`} description="Listings stay open for 60 days or until the deadline, whichever comes first, and can be closed at any time." />
      <CompanyJobForm company={{ id: company.id, name: company.name, verified: company.verificationStatus === "verified" }} />
    </div>
  );
}
