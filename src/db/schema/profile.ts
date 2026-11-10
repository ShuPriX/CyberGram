import { boolean, date, index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type {
  AchievementType,
  EmploymentType,
  MessagePolicy,
  NotificationPrefs,
  OpenToWorkVisibility,
  ProfileVisibility,
  VerificationStatus,
  WorkArrangement,
} from "../../lib/constants";
import { users } from "./auth";
import { companies } from "./company";
import { files } from "./platform";
import { createdAt, pk, textArray, tstz, updatedAt } from "./_shared";

export type ProfileLink = { label: string; url: string };

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline"),
    bio: text("bio"),
    currentTitle: text("current_title"),
    currentCompany: text("current_company"),
    location: text("location"),
    country: text("country"),
    avatarFileId: text("avatar_file_id").references(() => files.id, { onDelete: "set null" }),
    coverFileId: text("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    website: text("website"),
    githubUrl: text("github_url"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    links: jsonb("links").$type<ProfileLink[]>().notNull().default([]),
    yearsExperience: integer("years_experience"),
    /** Content-category slugs: professional domains and feed interests. */
    domains: textArray("domains"),
    /** Skill slugs (see `SKILLS`). */
    skills: textArray("skills"),

    // ── Job preferences ──
    openToWork: boolean("open_to_work").notNull().default(false),
    openToWorkVisibility: text("open_to_work_visibility").$type<OpenToWorkVisibility>().notNull().default("recruiters"),
    preferredEmploymentTypes: textArray("preferred_employment_types").$type<EmploymentType[]>(),
    preferredArrangements: textArray("preferred_arrangements").$type<WorkArrangement[]>(),
    preferredLocations: textArray("preferred_locations"),

    // ── Privacy ──
    visibility: text("visibility").$type<ProfileVisibility>().notNull().default("public"),
    /** Whether search engines may index the public profile. */
    indexable: boolean("indexable").notNull().default(true),
    /** Opt-in: appear in candidate discovery for recruiters at verified companies. */
    recruiterDiscoverable: boolean("recruiter_discoverable").notNull().default(false),
    messagePolicy: text("message_policy").$type<MessagePolicy>().notNull().default("everyone"),
    showEmail: boolean("show_email").notNull().default(false),

    notificationPrefs: jsonb("notification_prefs").$type<NotificationPrefs>().notNull().default({}),

    followerCount: integer("follower_count").notNull().default(0),
    followingCount: integer("following_count").notNull().default(0),
    connectionCount: integer("connection_count").notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("profiles_country_idx").on(t.country),
    index("profiles_discoverable_idx").on(t.recruiterDiscoverable),
    index("profiles_skills_idx").using("gin", t.skills),
    index("profiles_domains_idx").using("gin", t.domains),
  ],
);

export const experiences = pgTable(
  "experiences",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company").notNull(),
    /** Linked automatically when the name matches a company on the platform. */
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    employmentType: text("employment_type").$type<EmploymentType>(),
    location: text("location"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    isCurrent: boolean("is_current").notNull().default(false),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("experiences_user_idx").on(t.userId), index("experiences_company_idx").on(t.companyId)],
);

export const educations = pgTable(
  "educations",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    school: text("school").notNull(),
    degree: text("degree"),
    field: text("field"),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [index("educations_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    repoUrl: text("repo_url"),
    url: text("url"),
    tags: textArray("tags"),
    createdAt: createdAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

/**
 * Type-specific details live in `metadata` so new achievement kinds can be introduced
 * without schema changes (e.g. CTF rank/team, CVE id/severity, bounty platform).
 */
export type AchievementMetadata = {
  rank?: string;
  team?: string;
  cveId?: string;
  severity?: string;
  platform?: string;
  credentialId?: string;
};

export const achievements = pgTable(
  "achievements",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AchievementType>().notNull(),
    title: text("title").notNull(),
    issuer: text("issuer"),
    description: text("description"),
    achievedOn: date("achieved_on", { mode: "string" }),
    expiresOn: date("expires_on", { mode: "string" }),
    /** Public link supporting the claim (credential page, scoreboard, advisory, …). */
    evidenceUrl: text("evidence_url"),
    metadata: jsonb("metadata").$type<AchievementMetadata>().notNull().default({}),
    featured: boolean("featured").notNull().default(false),
    /**
     * Achievements are self-reported by default and are never auto-verified. A member
     * requests review; a moderator checks the evidence and records the outcome.
     */
    verificationStatus: text("verification_status").$type<VerificationStatus>().notNull().default("unverified"),
    verificationNote: text("verification_note"),
    verificationRequestedAt: tstz("verification_requested_at"),
    verifiedAt: tstz("verified_at"),
    verifiedById: text("verified_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("achievements_user_idx").on(t.userId, t.type),
    index("achievements_verification_idx").on(t.verificationStatus, t.verificationRequestedAt),
    index("achievements_type_idx").on(t.type, t.createdAt),
  ],
);
