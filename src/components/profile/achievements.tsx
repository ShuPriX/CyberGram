import { Award, Bug, ExternalLink, FileText, Flag, GitBranch, Medal, Mic, Milestone, ScrollText, ShieldAlert, Star, Trophy, type LucideIcon } from "lucide-react";
import { EXTERNAL_LINK_PROPS } from "@/components/shared/rich-text";
import { VerificationBadge } from "@/components/shared/fields";
import { Badge } from "@/components/ui/badge";
import { CheckboxField, InputField, SelectField, TextareaField } from "@/components/ui/form";
import type { achievements } from "@/db/schema";
import { ACHIEVEMENT_TYPES, ACHIEVEMENT_TYPE_META, type AchievementType } from "@/lib/constants";
import { leavingHref } from "@/lib/security/link-safety";
import { displayHost, formatDate } from "@/lib/utils";

export type Achievement = typeof achievements.$inferSelect;

const ICONS: Record<AchievementType, LucideIcon> = {
  certification: ScrollText,
  ctf: Flag,
  hackathon: Trophy,
  bug_bounty: Bug,
  hall_of_fame: Medal,
  cve: ShieldAlert,
  disclosure: ShieldAlert,
  publication: FileText,
  talk: Mic,
  open_source: GitBranch,
  award: Award,
  milestone: Milestone,
};

/** One achievement, always showing whether the claim was checked by a moderator. */
export function AchievementItem({ achievement, actions }: { achievement: Achievement; actions?: React.ReactNode }) {
  const meta = ACHIEVEMENT_TYPE_META[achievement.type];
  const Icon = ICONS[achievement.type];
  const details = [
    achievement.metadata.rank && `Rank: ${achievement.metadata.rank}`,
    achievement.metadata.team && `Team: ${achievement.metadata.team}`,
    achievement.metadata.cveId,
    achievement.metadata.severity && `Severity: ${achievement.metadata.severity}`,
    achievement.metadata.platform,
    achievement.metadata.credentialId && `Credential ID: ${achievement.metadata.credentialId}`,
  ].filter(Boolean);
  const expired = achievement.expiresOn ? achievement.expiresOn < new Date().toISOString().slice(0, 10) : false;

  return (
    <div className="flex gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
        <Icon className="size-[18px]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <h3 className="text-[14px] font-semibold leading-snug">
            {achievement.featured ? <Star className="mr-1 inline size-3.5 -translate-y-px fill-current text-warning" aria-label="Featured" /> : null}
            {achievement.title}
          </h3>
          <VerificationBadge status={achievement.verificationStatus} />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {meta.label}
          {achievement.issuer ? ` · ${achievement.issuer}` : ""}
          {achievement.achievedOn ? ` · ${formatDate(achievement.achievedOn, "monthYear")}` : ""}
          {achievement.expiresOn ? ` · ${expired ? "Expired" : "Valid until"} ${formatDate(achievement.expiresOn, "monthYear")}` : ""}
        </p>
        {details.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {details.map((detail) => (
              <Badge key={String(detail)} variant="outline">
                {detail}
              </Badge>
            ))}
          </div>
        ) : null}
        {achievement.description ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{achievement.description}</p> : null}
        {achievement.evidenceUrl ? (
          <a href={leavingHref(achievement.evidenceUrl)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" {...EXTERNAL_LINK_PROPS}>
            <ExternalLink className="size-3" aria-hidden="true" /> Evidence · {displayHost(achievement.evidenceUrl)}
          </a>
        ) : null}
        {actions ? <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Form fields for adding or editing an achievement (used inside an EntryDialog). */
export function AchievementFields({ achievement }: { achievement?: Achievement }) {
  return (
    <>
      {achievement ? <input type="hidden" name="id" value={achievement.id} /> : null}
      <SelectField label="Type" name="type" required options={ACHIEVEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} defaultValue={achievement?.type ?? "certification"} />
      <InputField label="Title" name="title" required maxLength={160} defaultValue={achievement?.title} placeholder="OSCP, 3rd place — picoCTF 2025, CVE-2025-12345…" />
      <InputField label="Issuer, event or organisation" name="issuer" optional maxLength={120} defaultValue={achievement?.issuer ?? ""} placeholder="OffSec, HackerOne, BSides Delhi…" />
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField label="Date achieved" name="achievedOn" type="date" optional defaultValue={achievement?.achievedOn ?? ""} />
        <InputField label="Expires" name="expiresOn" type="date" optional defaultValue={achievement?.expiresOn ?? ""} hint="For certifications that lapse." />
      </div>
      <InputField
        label="Evidence link"
        name="evidenceUrl"
        type="url"
        optional
        maxLength={2048}
        defaultValue={achievement?.evidenceUrl ?? ""}
        placeholder="https://www.credly.com/badges/…"
        hint="A public page that supports the claim: a credential, scoreboard, advisory or acknowledgement. Required to request verification."
      />
      <TextareaField label="Description" name="description" optional rows={3} maxLength={1500} defaultValue={achievement?.description ?? ""} />
      <details className="rounded-lg border px-3 py-2.5" open={Boolean(achievement && Object.keys(achievement.metadata).length > 0)}>
        <summary className="text-[13px] font-medium">More details (rank, team, CVE ID, credential ID)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <InputField label="Rank or placement" name="rank" optional maxLength={60} defaultValue={achievement?.metadata.rank ?? ""} placeholder="3rd of 1,200" />
          <InputField label="Team" name="team" optional maxLength={80} defaultValue={achievement?.metadata.team ?? ""} />
          <InputField label="CVE ID" name="cveId" optional maxLength={20} defaultValue={achievement?.metadata.cveId ?? ""} placeholder="CVE-2025-12345" />
          <SelectField label="Severity" name="severity" optional placeholder="Not applicable" options={["Low", "Medium", "High", "Critical"].map((s) => ({ value: s, label: s }))} defaultValue={achievement?.metadata.severity ?? ""} />
          <InputField label="Platform" name="platform" optional maxLength={60} defaultValue={achievement?.metadata.platform ?? ""} placeholder="HackerOne, Bugcrowd, CTFtime…" />
          <InputField label="Credential ID" name="credentialId" optional maxLength={80} defaultValue={achievement?.metadata.credentialId ?? ""} />
        </div>
      </details>
      <CheckboxField label="Feature on my profile" name="featured" defaultChecked={achievement?.featured ?? false} hint="Featured achievements are listed first." />
    </>
  );
}
