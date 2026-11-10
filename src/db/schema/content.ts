import { sql } from "drizzle-orm";
import { type AnyPgColumn, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { ContentStatus, PostType, PostVisibility } from "../../lib/constants";
import { users } from "./auth";
import { communities } from "./community";
import { companies } from "./company";
import { files } from "./platform";
import { createdAt, pk, tstz } from "./_shared";

export const posts = pgTable(
  "posts",
  {
    id: pk(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Set when a company member publishes on behalf of the organisation. */
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    communityId: text("community_id").references(() => communities.id, { onDelete: "cascade" }),
    type: text("type").$type<PostType>().notNull().default("post"),
    category: text("category").notNull().default("general"),
    /** Articles, write-ups and community threads carry a title; short updates do not. */
    title: text("title"),
    /** Unique URL slug, present for long-form articles. */
    slug: text("slug"),
    body: text("body").notNull(),
    excerpt: text("excerpt"),
    linkUrl: text("link_url"),
    coverFileId: text("cover_file_id").references(() => files.id, { onDelete: "set null" }),
    repostOfId: text("repost_of_id").references((): AnyPgColumn => posts.id, { onDelete: "cascade" }),
    visibility: text("visibility").$type<PostVisibility>().notNull().default("public"),
    status: text("status").$type<ContentStatus>().notNull().default("published"),
    /** Set when a link in the post matched a risk heuristic; surfaces in moderation. */
    flaggedReason: text("flagged_reason"),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    editedAt: tstz("edited_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("posts_slug_uq").on(t.slug),
    index("posts_created_idx").on(t.createdAt),
    index("posts_author_idx").on(t.authorId, t.createdAt),
    index("posts_category_idx").on(t.category, t.createdAt),
    index("posts_type_idx").on(t.type, t.createdAt),
    index("posts_company_idx").on(t.companyId, t.createdAt),
    index("posts_community_idx").on(t.communityId, t.createdAt),
    index("posts_repost_idx").on(t.repostOfId),
    index("posts_search_idx").using("gin", sql`to_tsvector('english', coalesce(${t.title}, '') || ' ' || ${t.body})`),
  ],
);

export const postAttachments = pgTable(
  "post_attachments",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.postId, t.fileId] })],
);

export const hashtags = pgTable(
  "hashtags",
  {
    id: pk(),
    tag: text("tag").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("hashtags_tag_uq").on(t.tag)],
);

export const postHashtags = pgTable(
  "post_hashtags",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    hashtagId: text("hashtag_id")
      .notNull()
      .references(() => hashtags.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.hashtagId] }), index("post_hashtags_tag_idx").on(t.hashtagId, t.createdAt)],
);

/** Resolved @mentions of members and organisations. */
export const postMentions = pgTable(
  "post_mentions",
  {
    id: pk(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    handle: text("handle").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
  },
  (t) => [index("post_mentions_post_idx").on(t.postId), index("post_mentions_user_idx").on(t.userId)],
);

export const comments = pgTable(
  "comments",
  {
    id: pk(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Replies are one level deep: a reply's parent is always a top-level comment. */
    parentId: text("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: text("status").$type<ContentStatus>().notNull().default("published"),
    likeCount: integer("like_count").notNull().default(0),
    editedAt: tstz("edited_at"),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt), index("comments_parent_idx").on(t.parentId)],
);

export const postLikes = pgTable(
  "post_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("post_likes_post_idx").on(t.postId)],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] })],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] }), index("bookmarks_user_idx").on(t.userId, t.createdAt)],
);
