import { Bookmark } from "lucide-react";
import Link from "next/link";
import { SaveJobButton } from "@/components/jobs/job-actions";
import { JobCard } from "@/components/jobs/job-card";
import { JobsNav } from "@/components/jobs/jobs-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { listSavedJobs } from "@/server/queries/hiring";

export const metadata = privateMetadata("Saved jobs");

export default async function SavedJobsPage() {
  const user = await requireUser();
  const jobs = await listSavedJobs(user.id);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader title="Saved jobs" description="Roles you bookmarked. Listings that have since closed are removed from search but stay here so you can see what happened." />
      <JobsNav current="saved" signedIn />
      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bookmark}
            title="No saved jobs"
            description="Use the bookmark on any listing to keep it here."
            action={
              <Button asChild>
                <Link href="/jobs">Browse jobs</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        jobs.map((job) => <JobCard key={job.id} job={job} action={<SaveJobButton jobId={job.id} saved signedIn />} />)
      )}
    </div>
  );
}
