import { BadgeCheck, MapPin } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { COMPANY_TYPE_LABELS, countryName } from "@/lib/constants";
import { pluralize } from "@/lib/utils";
import type { CompanyCard } from "@/server/queries/companies";

export function CompanyCardView({ company }: { company: CompanyCard }) {
  const place = company.hqLocation ?? countryName(company.hqCountry);
  return (
    <article className="group relative flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Avatar name={company.name} fileId={company.logoFileId} shape="square" />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1 text-[14.5px] font-semibold leading-snug">
            <Link href={`/companies/${company.slug}`} className="truncate after:absolute after:inset-0 group-hover:text-primary">
              {company.name}
            </Link>
            {company.verified ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified organisation" /> : null}
          </h3>
          <p className="text-xs text-muted-foreground">{COMPANY_TYPE_LABELS[company.type]}</p>
        </div>
        {company.isDemo ? <Badge variant="warning">Demo</Badge> : null}
      </div>
      {company.tagline ? <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{company.tagline}</p> : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-muted-foreground">
        {place ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" /> {place}
          </span>
        ) : null}
        <span>{pluralize(company.followerCount, "follower")}</span>
        {company.openJobs > 0 ? <Badge variant="primary" className="ml-auto">{pluralize(company.openJobs, "open role")}</Badge> : null}
      </div>
    </article>
  );
}
