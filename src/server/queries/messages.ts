import "server-only";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { conversationParticipants, conversations, messages, profiles, users } from "@/db/schema";

export type ConversationListItem = {
  id: string;
  lastMessageAt: Date;
  preview: string | null;
  unread: boolean;
  other: { id: string; username: string; name: string; headline: string | null; avatarFileId: string | null; active: boolean };
};

export type MessageItem = { id: string; body: string; createdAt: Date; mine: boolean };

export async function listConversations(userId: string, limit = 60): Promise<ConversationListItem[]> {
  const mine = alias(conversationParticipants, "mine");
  const theirs = alias(conversationParticipants, "theirs");
  const rows = await db
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      preview: conversations.lastMessagePreview,
      lastReadAt: mine.lastReadAt,
      unread: sql<boolean>`exists (
        select 1 from ${messages}
        where ${messages.conversationId} = ${conversations.id}
          and ${messages.senderId} <> ${userId}
          and ${messages.createdAt} > coalesce(${mine.lastReadAt}, 'epoch'::timestamptz)
      )`,
      otherId: users.id,
      otherUsername: users.username,
      otherName: users.name,
      otherStatus: users.status,
      otherHeadline: profiles.headline,
      otherAvatar: profiles.avatarFileId,
    })
    .from(mine)
    .innerJoin(conversations, eq(conversations.id, mine.conversationId))
    .innerJoin(theirs, and(eq(theirs.conversationId, conversations.id), ne(theirs.userId, userId)))
    .innerJoin(users, eq(users.id, theirs.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(mine.userId, userId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    lastMessageAt: row.lastMessageAt,
    preview: row.preview,
    unread: Boolean(row.unread),
    other: {
      id: row.otherId,
      username: row.otherUsername,
      name: row.otherName,
      headline: row.otherHeadline,
      avatarFileId: row.otherAvatar,
      active: row.otherStatus === "active",
    },
  }));
}

/** A conversation the member takes part in, with its most recent messages (oldest first). */
export async function getConversation(conversationId: string, userId: string, limit = 200) {
  if (!/^[a-z0-9]{8,40}$/.test(conversationId)) return null;
  const list = await listConversations(userId, 200);
  const conversation = list.find((c) => c.id === conversationId);
  if (!conversation) return null;
  const rows = await db
    .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  const items: MessageItem[] = rows.reverse().map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === userId }));
  return { conversation, messages: items };
}

export async function getMessagesAfter(conversationId: string, userId: string, after: Date): Promise<MessageItem[]> {
  const rows = await db
    .select({ id: messages.id, body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), gt(messages.createdAt, after)))
    .orderBy(asc(messages.createdAt))
    .limit(100);
  return rows.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, mine: m.senderId === userId }));
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
}
