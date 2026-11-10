import "server-only";
import { and, count, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversationParticipants, messages, notifications, profiles, users } from "@/db/schema";

export type UnreadCounts = { notifications: number; messages: number };

/** Badge counts for the header. Two indexed lookups; safe to poll. */
export async function getUnreadCounts(userId: string): Promise<UnreadCounts> {
  const [[notificationRow], [messageRow]] = await Promise.all([
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    db
      .select({ value: count() })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.userId, userId),
          sql`exists (
            select 1 from ${messages}
            where ${messages.conversationId} = ${conversationParticipants.conversationId}
              and ${messages.senderId} <> ${userId}
              and ${messages.createdAt} > coalesce(${conversationParticipants.lastReadAt}, 'epoch'::timestamptz)
          )`,
        ),
      ),
  ]);
  return { notifications: notificationRow?.value ?? 0, messages: messageRow?.value ?? 0 };
}

export type NotificationItem = {
  id: string;
  type: (typeof notifications.$inferSelect)["type"];
  data: (typeof notifications.$inferSelect)["data"];
  readAt: Date | null;
  createdAt: Date;
  actor: { username: string; name: string; avatarFileId: string | null } | null;
};

export async function listNotifications(
  userId: string,
  options: { before?: Date; limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationItem[]> {
  const { before, limit = 30, unreadOnly = false } = options;
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorUsername: users.username,
      actorName: users.name,
      actorAvatar: profiles.avatarFileId,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(notifications.userId, userId),
        unreadOnly ? isNull(notifications.readAt) : undefined,
        before ? lt(notifications.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    data: row.data,
    readAt: row.readAt,
    createdAt: row.createdAt,
    actor: row.actorUsername ? { username: row.actorUsername, name: row.actorName!, avatarFileId: row.actorAvatar } : null,
  }));
}
