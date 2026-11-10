import { boolean, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { Role, UserStatus } from "../../lib/constants";
import { createdAt, pk, tstz, updatedAt } from "./_shared";

export const users = pgTable(
  "users",
  {
    id: pk(),
    /** Always stored lower-cased; the unique index is therefore case-insensitive. */
    email: text("email").notNull(),
    emailVerifiedAt: tstz("email_verified_at"),
    /** Argon2id PHC string. Null for accounts that only sign in through OAuth. */
    passwordHash: text("password_hash"),
    username: text("username").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull().default("user"),
    status: text("status").$type<UserStatus>().notNull().default("active"),
    statusReason: text("status_reason"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: tstz("locked_until"),
    lastLoginAt: tstz("last_login_at"),
    onboardedAt: tstz("onboarded_at"),
    /** Marks accounts created by the opt-in demo seed so they can be labelled and purged. */
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
    index("users_created_idx").on(t.createdAt),
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.status),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token. The raw token only ever lives in the user's cookie. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at").notNull(),
    createdAt: createdAt(),
    lastUsedAt: tstz("last_used_at").notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: text("provider").$type<"github" | "google">().notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("oauth_accounts_user_idx").on(t.userId)],
);

export type AuthTokenType = "email_verify" | "password_reset";

/** Single-use, hashed, expiring tokens for email verification and password reset. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AuthTokenType>().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: tstz("expires_at").notNull(),
    usedAt: tstz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash), index("auth_tokens_user_idx").on(t.userId, t.type)],
);

/** Append-only record of security-relevant and administrative actions. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_actor_idx").on(t.actorId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_target_idx").on(t.targetType, t.targetId),
  ],
);
