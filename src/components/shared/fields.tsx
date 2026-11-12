import { BadgeCheck, CircleDashed, Clock, CircleX } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Badge } from "@/components/ui/badge";
import { SKILL_OPTIONS, skillLabel, VERIFICATION_LABELS, type VerificationStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * A wrap of selectable chips backed by real checkboxes (`name[]`), so it works without
 * JavaScript and is announced correctly by assistive technology.
 */
export function ChipGroup({
  legend,
  name,
  options,
  selected = [],
  type = "checkbox",
  bracket = true,
  hint,
  className,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected?: readonly string[];
  type?: "checkbox" | "radio";
  /** Submit as `name[]` (server actions). Turn off for GET filter forms, which repeat the plain name. */
  bracket?: boolean;
  hint?: string;
  className?: string;
}) {
  const chosen = new Set(selected);
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="text-[13px] font-medium">{legend}</legend>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex cursor-pointer select-none items-center rounded-full border bg-card px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary-soft-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring"
          >
            <input type={type} name={type === "checkbox" && bracket ? `${name}[]` : name} value={option.value} defaultChecked={chosen.has(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Suggestions for free-text skill inputs. Render once per page and reference by `list="skill-options"`. */
export function SkillDatalist() {
  return (
    <datalist id="skill-options">
      {SKILL_OPTIONS.map((skill) => (
        <option key={skill.slug} value={skill.name} />
      ))}
    </datalist>
  );
}

export function SkillBadges({ skills, max, linkToJobs = false, className }: { skills: readonly string[]; max?: number; linkToJobs?: boolean; className?: string }) {
  if (skills.length === 0) return null;
  const shown = max ? skills.slice(0, max) : skills;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((slug) => (
        <li key={slug}>
          {linkToJobs ? (
            <Link href={`/jobs?q=${encodeURIComponent(skillLabel(slug))}`} className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium leading-5 text-secondary-foreground hover:bg-border">
              {skillLabel(slug)}
            </Link>
          ) : (
            <Badge>{skillLabel(slug)}</Badge>
          )}
        </li>
      ))}
      {max && skills.length > max ? (
        <li>
          <Badge variant="outline">+{skills.length - max}</Badge>
        </li>
      ) : null}
    </ul>
  );
}

const VERIFICATION_META: Record<VerificationStatus, { variant: "success" | "neutral" | "warning" | "danger"; icon: React.ElementType }> = {
  verified: { variant: "success", icon: BadgeCheck },
  pending: { variant: "warning", icon: Clock },
  unverified: { variant: "neutral", icon: CircleDashed },
  rejected: { variant: "danger", icon: CircleX },
};

/** States plainly whether a claim has been checked. Never implies verification that did not happen. */
export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const { variant, icon: Icon } = VERIFICATION_META[status];
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden="true" /> {VERIFICATION_LABELS[status]}
    </Badge>
  );
}

/** Two-column page frame: main content plus a side rail that drops below on small screens. */
export function PageColumns({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]", className)}>
      <div className="min-w-0 space-y-4">{children}</div>
      {aside ? <aside className="min-w-0 space-y-4">{aside}</aside> : null}
    </div>
  );
}

export function DemoBanner({ what }: { what: string }) {
  return (
    <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[13px] text-warning">
      <strong className="font-semibold">Demo data.</strong> This {what} was created by the development seed to illustrate the product. It is not real.
    </p>
  );
}
