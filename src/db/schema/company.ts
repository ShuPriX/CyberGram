import { boolean, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { CompanyMemberRole, CompanySize, CompanyType, VerificationStatus } from "../../lib/constants";
import { users } from "./auth";
import { files } from "./platform";
import { createdAt, pk, textArray, tstz, updatedAt } from "./_shared";

export const companies = pgTable(
  "companies",
  {
    id: pk(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    type: text("type").$type<CompanyType>().notNull().default("other"),
    /** Content-category slugs the organisation specialises in. */
    specializations: textArray("specializations"),
    size: text("size").$type<CompanySize>(),
    hqLocation: text("hq_location"),
    hqCountry: text("hq_country"),
    locations: textArray("locations"),
    website: text("website"),
    linkedinUrl: text("linkedin_url"),
    twitterUrl: text("twitter_url"),
    githubUrl: text("github_url"),
    logoFileId: text("logo_file_id").references(() => files.id, { onDelete: "set null" }),
    coverFileId: text("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    /**
     * Organisations are never verified automatically. An owner requests review and an
     * administrator decides; the badge is only rendered for `verified`.
     */
    verificationStatus: text("verification_status").$type<VerificationStatus>().notNull().default("unverified"),
    verificationEvidence: text("verification_evidence"),
    verificationNote: text("verification_note"),
    verificationRequestedAt: tstz("verification_requested_at"),
    verifiedAt: tstz("verified_at"),
    verifiedById: text("verified_by_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<"active" | "suspended">().notNull().default("active"),
    followerCount: integer("follower_count").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("companies_slug_uq").on(t.slug),
    index("companies_name_idx").on(t.name),
    index("companies_verification_idx").on(t.verificationStatus),
  ],
);

export const companyMembers = pgTable(
  "company_members",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<CompanyMemberRole>().notNull().default("recruiter"),
    title: text("title"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userId] }), index("company_members_user_idx").on(t.userId)],
);

export const companyFollows = pgTable(
  "company_follows",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.companyId] }), index("company_follows_company_idx").on(t.companyId)],
);
