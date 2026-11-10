import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { EventType, ModerationStatus, ResourceLevel, ResourceType } from "../../lib/constants";
import { users } from "./auth";
import { createdAt, pk, tstz, updatedAt } from "./_shared";

export const communities = pgTable(
  "communities",
  {
    id: pk(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Content-category slug the community is anchored to. */
    category: text("category").notNull().default("general"),
    rules: text("rules"),
    /** Platform-run communities are created by the seed and cannot be deleted by members. */
    isOfficial: boolean("is_official").notNull().default(false),
    memberCount: integer("member_count").notNull().default(0),
    postCount: integer("post_count").notNull().default(0),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("communities_slug_uq").on(t.slug), index("communities_category_idx").on(t.category)],
);

export const communityMembers = pgTable(
  "community_members",
  {
    communityId: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"member" | "moderator" | "owner">().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.userId] }), index("community_members_user_idx").on(t.userId)],
);

/** Conferences, CTFs, competitions and training announcements. Community-submitted, moderated. */
export const events = pgTable(
  "events",
  {
    id: pk(),
    title: text("title").notNull(),
    type: text("type").$type<EventType>().notNull(),
    description: text("description"),
    url: text("url").notNull(),
    organizer: text("organizer"),
    location: text("location"),
    country: text("country"),
    isOnline: boolean("is_online").notNull().default(false),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at"),
    status: text("status").$type<ModerationStatus>().notNull().default("pending"),
    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("events_status_start_idx").on(t.status, t.startsAt), index("events_type_idx").on(t.type, t.startsAt)],
);

export const resources = pgTable(
  "resources",
  {
    id: pk(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    type: text("type").$type<ResourceType>().notNull(),
    category: text("category").notNull().default("general"),
    level: text("level").$type<ResourceLevel>().notNull().default("beginner"),
    isFree: boolean("is_free").notNull().default(true),
    /** Curated by the platform team rather than submitted by a member. */
    isCurated: boolean("is_curated").notNull().default(false),
    upvoteCount: integer("upvote_count").notNull().default(0),
    status: text("status").$type<ModerationStatus>().notNull().default("pending"),
    submittedById: text("submitted_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("resources_url_uq").on(t.url),
    index("resources_status_idx").on(t.status, t.upvoteCount),
    index("resources_category_idx").on(t.category, t.status),
  ],
);

export const resourceVotes = pgTable(
  "resource_votes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.resourceId] })],
);

export type RoadmapStep = {
  title: string;
  summary: string;
  /** What someone should be able to do before moving on. */
  outcomes: string[];
  /** Skill slugs practised in this step. */
  skills?: string[];
};

export const roadmaps = pgTable(
  "roadmaps",
  {
    id: pk(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull().default("general"),
    level: text("level").$type<ResourceLevel>().notNull().default("beginner"),
    steps: jsonb("steps").$type<RoadmapStep[]>().notNull().default([]),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("roadmaps_slug_uq").on(t.slug)],
);

export const roadmapProgress = pgTable(
  "roadmap_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roadmapId: text("roadmap_id")
      .notNull()
      .references(() => roadmaps.id, { onDelete: "cascade" }),
    /** Zero-based indexes of completed steps. */
    completedSteps: jsonb("completed_steps").$type<number[]>().notNull().default([]),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roadmapId] })],
);
