import { index, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { NotificationType } from "../../lib/constants";
import { users } from "./auth";
import { createdAt, pk, tstz } from "./_shared";

/** One-directional follow between members. */
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] }), index("follows_following_idx").on(t.followingId)],
);

export type ConnectionStatus = "pending" | "accepted" | "declined";

/** Mutual, request-based professional connection. */
export const connections = pgTable(
  "connections",
  {
    id: pk(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** `min(id):max(id)` — guarantees a single row per pair regardless of direction. */
    pairKey: text("pair_key").notNull(),
    status: text("status").$type<ConnectionStatus>().notNull().default("pending"),
    note: text("note"),
    createdAt: createdAt(),
    respondedAt: tstz("responded_at"),
  },
  (t) => [
    uniqueIndex("connections_pair_uq").on(t.pairKey),
    index("connections_requester_idx").on(t.requesterId, t.status),
    index("connections_addressee_idx").on(t.addresseeId, t.status),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: pk(),
    /** `min(id):max(id)` of the two participants — one direct conversation per pair. */
    pairKey: text("pair_key").notNull(),
    lastMessageAt: tstz("last_message_at").notNull().defaultNow(),
    lastMessagePreview: text("last_message_preview"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("conversations_pair_uq").on(t.pairKey), index("conversations_last_idx").on(t.lastMessageAt)],
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: tstz("last_read_at"),
  },
  (t) => [primaryKey({ columns: [t.conversationId, t.userId] }), index("conversation_participants_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: pk(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

export type NotificationData = {
  /** Destination when the notification is opened. Always a same-origin path. */
  href?: string;
  /** Short supporting text, e.g. a comment preview or job title. */
  preview?: string;
  title?: string;
};

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationType>().notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    data: jsonb("data").$type<NotificationData>().notNull().default({}),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.readAt),
  ],
);
