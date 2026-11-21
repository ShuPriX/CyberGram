import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, pk, tstz } from "./_shared";

export type PublishChannel = "instagram";
export type PublishStatus = "pending" | "published" | "failed";

/** What a social card shows. Stored with the row so the card image can be rendered from it alone. */
export type CardPayload =
  | { kind: "news"; title: string; source: string; sourceKind: "official" | "research" | "press"; domain: string }
  | { kind: "jobs"; total: number; roles: { title: string; company: string; place: string }[] };

/**
 * Ledger of what the platform has published (or tried to publish) to its outside accounts.
 * The unique `(channel, key)` pair is the claim on a story or digest: it is inserted before
 * anything is sent, so the same item is never posted twice even when two instances race.
 */
export const outboundPosts = pgTable(
  "outbound_posts",
  {
    id: pk(),
    channel: text("channel").$type<PublishChannel>().notNull(),
    /** Identifies the content, e.g. `news:<news item id>` or `jobs:2026-11-21`. */
    key: text("key").notNull(),
    status: text("status").$type<PublishStatus>().notNull().default("pending"),
    payload: jsonb("payload").$type<CardPayload>().notNull(),
    caption: text("caption").notNull(),
    /** The platform's own id for the published post. */
    externalId: text("external_id"),
    error: text("error"),
    createdAt: createdAt(),
    publishedAt: tstz("published_at"),
  },
  (t) => [uniqueIndex("outbound_posts_key_uq").on(t.channel, t.key), index("outbound_posts_recent_idx").on(t.channel, t.createdAt)],
);

/**
 * The renewed access token for a connected account, encrypted at rest. Instagram's
 * long-lived tokens last 60 days and are renewed automatically; the renewed value lives here
 * because an environment variable cannot be rewritten by the running app.
 */
export const outboundAccounts = pgTable("outbound_accounts", {
  channel: text("channel").$type<PublishChannel>().primaryKey(),
  /** AES-256-GCM, base64: iv ‖ tag ‖ ciphertext. */
  tokenCipher: text("token_cipher").notNull(),
  /** SHA-256 of the environment token this value was renewed from. A different env token replaces it. */
  seedFingerprint: text("seed_fingerprint").notNull(),
  expiresAt: tstz("expires_at").notNull(),
  refreshedAt: tstz("refreshed_at").notNull().defaultNow(),
});
