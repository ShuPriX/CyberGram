import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCardView } from "@/components/companies/company-card";
import { FeedList } from "@/components/feed/feed-list";
import { JobCard } from "@/components/jobs/job-card";
import { PersonRow } from "@/components/people/person";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LinkTabs } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { searchCompanies } from "@/server/queries/companies";
import { listJobs } from "@/server/queries/jobs";
import { searchPeople } from "@/server/queries/people";
import { getFeed } from "@/server/queries/posts";
import { getCategoryNames } from "@/server/queries/taxonomy";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const TABS = ["all", "people", "posts", "jobs", "companies"] as const;
type Tab = (typeof TABS)[number];

function Group({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {href ? (
          <Link href={href} className="text-[13px] font-medium text-primary hover:underline">
            See all
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tab: Tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "all";
  const user = await getCurrentUser();
  const viewer = user ? { id: user.id, role: user.role } : null;
  const href = (t: Tab) => `/search?q=${encodeURIComponent(q)}${t === "all" ? "" : `&tab=${t}`}`;

  const searchBox = (
    <form action="/search" method="get" role="search" className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        type="search"
        name="q"
        defaultValue={q}
        autoFocus={!q}
        maxLength={100}
        placeholder="Search people, posts, jobs and companies"
        aria-label="Search"
        className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-4 text-[15px] placeholder:text-subtle focus-visible:border-ring focus-visible:outline-none"
      />
      {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
    </form>
  );

  if (q.length < 2) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        {searchBox}
        <Card>
          <EmptyState icon={Search} title="Search CyberGram" description="Find practitioners by name or skill, posts by topic, open roles and hiring organisations." />
        </Card>
      </div>
    );
  }

  const limit = await rateLimit("search", user?.id ?? (await getRequestMeta()).ip);
  if (!limit.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        {searchBox}
        <Card>
          <EmptyState icon={Search} title="Too many searches" description={`Please wait ${limit.retryAfterSec} seconds and try again.`} />
        </Card>
      </div>
    );
  }

  const wide = tab !== "all";
  const [people, posts, jobs, companies, categories] = await Promise.all([
    tab === "all" || tab === "people" ? searchPeople(q, wide ? 40 : 4, { signedIn: Boolean(user) }) : [],
    tab === "all" || tab === "posts" ? getFeed({ viewer, q, limit: wide ? 12 : 3 }) : null,
    tab === "all" || tab === "jobs" ? listJobs({ q, sort: "relevance", pageSize: wide ? 30 : 4, viewerId: user?.id }) : null,
    tab === "all" || tab === "companies" ? searchCompanies(q, wide ? 30 : 4) : [],
    getCategoryNames(),
  ]);
  const nothing = people.length === 0 && !posts?.posts.length && !jobs?.items.length && companies.length === 0;
  const context = { viewer: user ? { name: user.name, avatarFileId: user.avatarFileId } : null, categories };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <h1 className="text-xl font-semibold tracking-tight">Results for “{q}”</h1>
      {searchBox}
      <LinkTabs current={tab} items={TABS.map((t) => ({ value: t, label: t[0]!.toUpperCase() + t.slice(1), href: href(t) }))} />

      {nothing ? (
        <Card>
          <EmptyState icon={Search} title="No results" description="Try a shorter or more general term, or check the spelling." />
        </Card>
      ) : null}

      {people.length > 0 ? (
        <Group title="People" href={wide ? undefined : href("people")}>
          <Card>
            <CardContent className="space-y-4">
              {people.map((person) => (
                <PersonRow key={person.id} person={person} />
              ))}
            </CardContent>
          </Card>
        </Group>
      ) : null}

      {jobs && jobs.items.length > 0 ? (
        <Group title={`Jobs (${jobs.total})`} href={wide ? `/jobs?q=${encodeURIComponent(q)}` : href("jobs")}>
          {jobs.items.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </Group>
      ) : null}

      {companies.length > 0 ? (
        <Group title="Companies" href={wide ? undefined : href("companies")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((company) => (
              <CompanyCardView key={company.id} company={company} />
            ))}
          </div>
        </Group>
      ) : null}

      {posts && posts.posts.length > 0 ? (
        <Group title="Posts" href={wide ? undefined : href("posts")}>
          <FeedList key={`${q}:${tab}`} initial={wide ? posts : { posts: posts.posts, nextCursor: null }} request={{ q }} context={context} />
        </Group>
      ) : null}
    </div>
  );
}
