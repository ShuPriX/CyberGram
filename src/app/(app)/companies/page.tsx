import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCardView } from "@/components/companies/company-card";
import { one, withParams, type RawParams } from "@/components/jobs/jobs-nav";
import { JsonLd } from "@/components/shared/json-ld";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Pager } from "@/components/ui/misc";
import { COMPANY_TYPES, COUNTRIES, COUNTRY_CODES } from "@/lib/constants";
import { breadcrumbLd, pageMetadata } from "@/lib/seo";
import { listCompanies } from "@/server/queries/companies";
import { getActiveCategories } from "@/server/queries/taxonomy";

export const metadata: Metadata = pageMetadata({
  title: "Cybersecurity Companies Hiring Now",
  description: "Discover cybersecurity startups, security product companies, MSSPs, consulting firms and enterprise security teams — and see which are hiring.",
  path: "/companies",
});

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const categories = await getActiveCategories();
  const type = COMPANY_TYPES.find((t) => t.value === one(params.type))?.value;
  const specialization = categories.find((c) => c.slug === one(params.focus))?.slug;
  const country = one(params.country)?.toUpperCase();
  const page = Number(one(params.page)) || 1;
  const filters = {
    q: one(params.q),
    type,
    specialization,
    country: country && COUNTRY_CODES.includes(country) ? country : undefined,
    hiring: one(params.hiring) === "1",
    verified: one(params.verified) === "1",
    page,
  };
  const result = await listCompanies(filters);
  const filtered = Boolean(filters.q || type || specialization || filters.country || filters.hiring || filters.verified);

  return (
    <div className="space-y-5">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Companies", path: "/companies" }])} />
      <PageHeader
        title="Companies"
        description="Organisations that build, sell or run security. A verified badge means our team confirmed the page is run by the organisation it names."
        action={
          <Button asChild>
            <Link href="/companies/new">
              <Plus /> Add your organisation
            </Link>
          </Button>
        }
      />

      <form action="/companies" method="get" className="grid gap-3 rounded-xl border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <Input name="q" type="search" defaultValue={filters.q ?? ""} maxLength={80} placeholder="Search by name" aria-label="Search companies" />
        <Select name="type" defaultValue={type ?? ""} aria-label="Organisation type">
          <option value="">Any type</option>
          {COMPANY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <Select name="focus" defaultValue={specialization ?? ""} aria-label="Specialisation">
          <option value="">Any specialisation</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select name="country" defaultValue={filters.country ?? ""} aria-label="Headquarters country">
          <option value="">Any country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] sm:col-span-2 lg:col-span-5">
          <label className="flex items-center gap-2">
            <Checkbox name="hiring" value="1" defaultChecked={filters.hiring} /> Hiring now
          </label>
          <label className="flex items-center gap-2">
            <Checkbox name="verified" value="1" defaultChecked={filters.verified} /> Verified only
          </label>
          {filtered ? (
            <Link href="/companies" className="font-medium text-primary hover:underline">Clear filters</Link>
          ) : null}
          <span className="ml-auto text-muted-foreground">{result.total} {result.total === 1 ? "organisation" : "organisations"}</span>
        </div>
      </form>

      {result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title={filtered ? "No organisations match these filters" : "No organisations yet"}
            description={filtered ? "Try a broader search." : "Be the first to add your security team or company and start hiring from the community."}
            action={
              <Button asChild variant="outline">
                <Link href={filtered ? "/companies" : "/companies/new"}>{filtered ? "Clear filters" : "Add your organisation"}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((company) => (
            <li key={company.id}>
              <CompanyCardView company={company} />
            </li>
          ))}
        </ul>
      )}
      <Pager
        prevHref={result.page > 1 ? withParams("/companies", params, { page: result.page > 2 ? String(result.page - 1) : null }) : null}
        nextHref={result.hasMore ? withParams("/companies", params, { page: String(result.page + 1) }) : null}
      />
    </div>
  );
}
