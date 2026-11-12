import { Lock, SearchX } from "lucide-react";
import Link from "next/link";
import { one, withParams, type RawParams } from "@/components/jobs/jobs-nav";
import { MessageButton } from "@/components/people/person";
import { SkillBadges, SkillDatalist } from "@/components/shared/fields";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Pager } from "@/components/ui/misc";
import { requireOnboardedUser } from "@/lib/auth/session";
import { COUNTRIES, COUNTRY_CODES, countryName } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { privateMetadata } from "@/lib/seo";
import { slugify } from "@/lib/utils";
import { searchCandidates } from "@/server/queries/hiring";
import { isVerifiedRecruiter } from "@/server/queries/people";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata = privateMetadata("Find candidates");

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const user = await requireOnboardedUser();
  const params = await searchParams;

  // Candidate discovery is restricted to members of a *verified* organisation.
  if (!(await isVerifiedRecruiter(user.id))) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <PageHeader title="Find candidates" />
        <Card>
          <EmptyState
            icon={Lock}
            title="Available to verified organisations"
            description="To protect members from unsolicited or fraudulent outreach, candidate discovery is limited to recruiters whose organisation has been verified."
            action={
              <Button asChild>
                <Link href="/recruiter">Go to the recruiter portal</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const categories = await getActiveCategories();
  const country = one(params.country)?.toUpperCase();
  const skills = (one(params.skills) ?? "").split(",").map((s) => slugify(s, 60)).filter(Boolean).slice(0, 10);
  const filters = {
    q: one(params.q),
    skills,
    domain: categories.find((c) => c.slug === one(params.domain))?.slug,
    country: country && COUNTRY_CODES.includes(country) ? country : undefined,
    openToWork: one(params.open) === "1",
    page: Number(one(params.page)) || 1,
  };
  const result = await searchCandidates(filters);
  if (filters.q || skills.length > 0 || filters.domain) {
    await audit("recruiter.candidate_search", { actorId: user.id, metadata: { skills, domain: filters.domain, country: filters.country } });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Find candidates" description="Members who chose to be discoverable by recruiters. Everyone listed here opted in, and can opt out at any time." />
      <form action="/recruiter/candidates" method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto]">
        <Input name="q" type="search" defaultValue={filters.q ?? ""} maxLength={80} placeholder="Name, headline or title" aria-label="Keywords" />
        <Input name="skills" list="skill-options" defaultValue={one(params.skills) ?? ""} maxLength={200} placeholder="Skills, comma-separated" aria-label="Skills" />
        <SkillDatalist />
        <Select name="domain" defaultValue={filters.domain ?? ""} aria-label="Domain">
          <option value="">Any domain</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select name="country" defaultValue={filters.country ?? ""} aria-label="Country">
          <option value="">Any country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2 lg:col-span-5">
          <Checkbox name="open" value="1" defaultChecked={filters.openToWork} /> Open to work only
          <span className="ml-auto text-muted-foreground">{result.total} {result.total === 1 ? "candidate" : "candidates"}</span>
        </label>
      </form>

      {result.items.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="No candidates match" description="Try fewer skills or a broader domain. Only members who opted in to discovery appear here." />
        </Card>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {result.items.map((candidate) => (
            <li key={candidate.id}>
              <Card className="h-full">
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Link href={`/u/${candidate.username}`} className="shrink-0">
                      <Avatar name={candidate.name} fileId={candidate.avatarFileId} size="lg" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <Link href={`/u/${candidate.username}`} className="text-[15px] font-semibold hover:underline">{candidate.name}</Link>
                        {candidate.openToWork ? <Badge variant="success">Open to work</Badge> : null}
                      </p>
                      {candidate.headline ? <p className="line-clamp-2 text-[13px] text-muted-foreground">{candidate.headline}</p> : null}
                      <p className="mt-0.5 text-xs text-subtle">
                        {[candidate.location, countryName(candidate.country), candidate.yearsExperience !== null ? `${candidate.yearsExperience} yrs` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <MessageButton userId={candidate.id} />
                  </div>
                  <SkillBadges skills={candidate.skills} max={8} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager
        prevHref={result.page > 1 ? withParams("/recruiter/candidates", params, { page: result.page > 2 ? String(result.page - 1) : null }) : null}
        nextHref={result.hasMore ? withParams("/recruiter/candidates", params, { page: String(result.page + 1) }) : null}
      />
    </div>
  );
}
