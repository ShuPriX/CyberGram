import { BellPlus, SearchX, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { ChipGroup } from "@/components/shared/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { EmptyState, Pager } from "@/components/ui/misc";
import { COUNTRIES, COUNTRY_CODES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, JOB_CATEGORIES, WORK_ARRANGEMENTS } from "@/lib/constants";
import { formatCount } from "@/lib/utils";
import { listJobs, type JobFilters } from "@/server/queries/jobs";
import { JobCard } from "./job-card";
import { SaveJobButton } from "./job-actions";
import { many, one, withParams, type RawParams } from "./jobs-nav";

const POSTED = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
];

const allowed = <T extends string>(values: string[], options: readonly { value?: T; slug?: T }[]) => {
  const known = new Set(options.map((o) => (o.value ?? o.slug) as string));
  return values.filter((v) => known.has(v));
};

/** Translates URL parameters into validated filters. Unknown values are dropped, never passed on. */
export function parseJobFilters(params: RawParams): JobFilters {
  const country = one(params.country)?.toUpperCase();
  const posted = Number(one(params.posted));
  const page = Number(one(params.page));
  return {
    q: one(params.q)?.slice(0, 100),
    country: country && COUNTRY_CODES.includes(country) ? country : undefined,
    remote: one(params.remote) === "1",
    categories: allowed(many(params.category), JOB_CATEGORIES),
    levels: allowed(many(params.level), EXPERIENCE_LEVELS),
    types: allowed(many(params.type), EMPLOYMENT_TYPES),
    arrangements: allowed(many(params.arrangement), WORK_ARRANGEMENTS),
    postedWithinDays: [1, 7, 30].includes(posted) ? posted : undefined,
    hasSalary: one(params.salary) === "1",
    earlyCareerOnly: one(params.early) === "1",
    sort: one(params.sort) === "relevance" ? "relevance" : "recent",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/**
 * The job search experience: filters, results and pagination. Used by /jobs and by the
 * landing pages, which pin some filters (`fixed`) and hide the matching controls.
 */
export async function JobBrowser({
  params,
  basePath,
  fixed = {},
  viewerId,
  heading = "Results",
}: {
  params: RawParams;
  basePath: string;
  fixed?: Partial<JobFilters>;
  viewerId: string | null;
  heading?: string;
}) {
  const parsed = parseJobFilters(params);
  const filters: JobFilters = { ...parsed, ...fixed, prioritizeEarlyCareer: parsed.sort !== "relevance", viewerId };
  const result = await listJobs(filters);
  const { page } = result;
  const activeCount =
    (parsed.q ? 1 : 0) + (parsed.country ? 1 : 0) + (parsed.remote ? 1 : 0) + (parsed.categories?.length ?? 0) + (parsed.levels?.length ?? 0) + (parsed.types?.length ?? 0) +
    (parsed.arrangements?.length ?? 0) + (parsed.postedWithinDays ? 1 : 0) + (parsed.hasSalary ? 1 : 0) + (parsed.earlyCareerOnly ? 1 : 0);
  const alertHref = withParams("/jobs/alerts", params, { page: null, sort: null, posted: null, salary: null, arrangement: null, early: null });

  const filterForm = (
    <form action={basePath} method="get" className="space-y-5">
      <div>
        <label htmlFor="job-q" className="text-[13px] font-medium">Keywords</label>
        <Input id="job-q" name="q" type="search" defaultValue={parsed.q ?? ""} maxLength={100} placeholder="Title, skill or company" className="mt-1.5" />
      </div>
      {fixed.country === undefined ? (
        <div>
          <label htmlFor="job-country" className="text-[13px] font-medium">Country</label>
          <Select id="job-country" name="country" defaultValue={parsed.country ?? ""} className="mt-1.5">
            <option value="">Anywhere</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="space-y-2.5">
        {fixed.remote === undefined ? (
          <label className="flex items-center gap-2.5 text-[13px]">
            <Checkbox name="remote" value="1" defaultChecked={parsed.remote} /> Remote only
          </label>
        ) : null}
        {fixed.earlyCareerOnly === undefined ? (
          <label className="flex items-center gap-2.5 text-[13px]">
            <Checkbox name="early" value="1" defaultChecked={parsed.earlyCareerOnly} /> Internships &amp; fresher roles
          </label>
        ) : null}
        <label className="flex items-center gap-2.5 text-[13px]">
          <Checkbox name="salary" value="1" defaultChecked={parsed.hasSalary} /> Salary disclosed
        </label>
      </div>
      {fixed.levels === undefined ? <ChipGroup legend="Experience level" name="level" bracket={false} options={EXPERIENCE_LEVELS} selected={parsed.levels} /> : null}
      {fixed.types === undefined ? <ChipGroup legend="Employment type" name="type" bracket={false} options={EMPLOYMENT_TYPES} selected={parsed.types} /> : null}
      {fixed.arrangements === undefined && fixed.remote === undefined ? (
        <ChipGroup legend="Work arrangement" name="arrangement" bracket={false} options={WORK_ARRANGEMENTS} selected={parsed.arrangements} />
      ) : null}
      {fixed.categories === undefined ? (
        <ChipGroup legend="Role" name="category" bracket={false} options={JOB_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))} selected={parsed.categories} />
      ) : null}
      <div>
        <label htmlFor="job-posted" className="text-[13px] font-medium">Date posted</label>
        <Select id="job-posted" name="posted" defaultValue={parsed.postedWithinDays ? String(parsed.postedWithinDays) : ""} className="mt-1.5">
          <option value="">Any time</option>
          {POSTED.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>
      {parsed.sort === "relevance" ? <input type="hidden" name="sort" value="relevance" /> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" className="flex-1">Apply filters</Button>
        {activeCount > 0 ? (
          <Button asChild variant="ghost">
            <Link href={basePath}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside>
        <details className="group rounded-xl border bg-card shadow-card lg:hidden">
          <summary className="flex items-center gap-2 px-4 py-3 text-[13px] font-medium">
            <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          </summary>
          <div className="border-t p-4">{filterForm}</div>
        </details>
        <Card className="hidden lg:block">
          <CardContent>{filterForm}</CardContent>
        </Card>
      </aside>

      <section aria-labelledby="job-results" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="job-results" className="text-[15px] font-semibold">
            {heading} <span className="font-normal text-muted-foreground">· {formatCount(result.total)} open {result.total === 1 ? "role" : "roles"}</span>
          </h2>
          <div className="flex items-center gap-1.5 text-[13px]">
            {parsed.q ? (
              <>
                <span className="text-muted-foreground">Sort:</span>
                <Link href={withParams(basePath, params, { sort: null, page: null })} className={parsed.sort === "recent" ? "font-semibold" : "text-primary hover:underline"}>Newest</Link>
                <Link href={withParams(basePath, params, { sort: "relevance", page: null })} className={parsed.sort === "relevance" ? "font-semibold" : "text-primary hover:underline"}>Relevance</Link>
              </>
            ) : null}
            {viewerId ? (
              <Button asChild variant="outline" size="sm" className="ml-2">
                <Link href={alertHref}>
                  <BellPlus /> Create alert
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-subtle">
          Listings are re-checked against their source daily and removed when they close. Each one shows where it came from.
        </p>

        {result.items.length === 0 ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No open roles match these filters"
              description="We only show roles that are currently open. Try removing a filter, or create an alert to hear when a match is posted."
              action={
                activeCount > 0 ? (
                  <Button asChild variant="outline">
                    <Link href={basePath}>Clear filters</Link>
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          result.items.map((job) => <JobCard key={job.id} job={job} action={<SaveJobButton jobId={job.id} saved={job.viewer.saved} signedIn={Boolean(viewerId)} />} />)
        )}

        <Pager
          className="pt-2"
          prevHref={page > 1 ? withParams(basePath, params, { page: page > 2 ? String(page - 1) : null }) : null}
          nextHref={result.hasMore ? withParams(basePath, params, { page: String(page + 1) }) : null}
        />
      </section>
    </div>
  );
}
