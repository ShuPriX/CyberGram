import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { ReportReason, ReportTargetType } from "../../lib/constants";
import { users } from "./auth";
import { createdAt, pk, tstz } from "./_shared";

export type FileKind = "avatar" | "cover" | "logo" | "post_media" | "attachment" | "resume";
export type ScanStatus = "pending" | "clean" | "skipped" | "infected" | "error";

/** Metadata for every uploaded object. Bytes live in the configured storage driver. */
export const files = pgTable(
  "files",
  {
    id: pk(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").$type<FileKind>().notNull(),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    /** Content type determined from the file's bytes, never from the client. */
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    scanStatus: text("scan_status").$type<ScanStatus>().notNull().default("pending"),
    /** `private` files (résumés) are only served to their owner and authorised recruiters. */
    visibility: text("visibility").$type<"public" | "private">().notNull().default("private"),
    createdAt: createdAt(),
  },
  (t) => [index("files_owner_idx").on(t.ownerId, t.kind)],
);

/** Admin-managed content categories. Seeded from `CATEGORIES`. */
export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export type ReportStatus = "open" | "resolved" | "dismissed";

export const reports = pgTable(
  "reports",
  {
    id: pk(),
    reporterId: text("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").$type<ReportTargetType>().notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").$type<ReportReason>().notNull(),
    details: text("details"),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    resolution: text("resolution"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: tstz("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt), index("reports_target_idx").on(t.targetType, t.targetId)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: pk(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    topic: text("topic").notNull(),
    message: text("message").notNull(),
    status: text("status").$type<"new" | "handled">().notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [index("contact_messages_status_idx").on(t.status, t.createdAt)],
);
