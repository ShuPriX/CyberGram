"use server";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyFollows, connections, conversationParticipants, conversations, follows, messages, notifications, profiles, users } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { LIMITS } from "@/lib/constants";
import { excerptOf } from "@/lib/text";
import { zBool, zId, zOptionalId, zOptionalText, zText } from "@/lib/validation";
import { callAction, fail, formAction, ok } from "@/server/action-utils";
import { getMessagesAfter, type MessageItem } from "@/server/queries/messages";
import { isVerifiedRecruiter, pairKey } from "@/server/queries/people";
import { bumpProfileCounter } from "@/server/services/access";
import { notify } from "@/server/services/notify";

const DAY = 24 * 60 * 60 * 1000;

async function activeMember(id: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username, messagePolicy: profiles.messagePolicy })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, id), eq(users.status, "active")))
    .limit(1);
  return row ?? null;
}

// ── Follow ───────────────────────────────────────────────────────────────────

export const toggleFollowAction = callAction({ schema: z.object({ userId: zId }), rateLimit: "follow" }, async ({ userId }, { user }) => {
  if (userId === user.id) return fail("You cannot follow yourself.");
  const target = await activeMember(userId);
  if (!target) return fail("That member is not available.");

  const removed = await db.delete(follows).where(and(eq(follows.followerId, user.id), eq(follows.followingId, userId))).returning({ id: follows.followingId });
  if (removed.length > 0) {
    await Promise.all([bumpProfileCounter(userId, "followerCount", -1), bumpProfileCounter(user.id, "followingCount", -1)]);
    return ok(undefined, { following: false });
  }
  const added = await db.insert(follows).values({ followerId: user.id, followingId: userId }).onConflictDoNothing().returning({ id: follows.followingId });
  if (added.length > 0) {
    await Promise.all([bumpProfileCounter(userId, "followerCount", 1), bumpProfileCounter(user.id, "followingCount", 1)]);
    await notify({
      userId,
      actorId: user.id,
      type: "follow",
      entityType: "user",
      entityId: user.id,
      data: { title: `${user.name} started following you`, href: `/u/${user.username}` },
    });
  }
  return ok(undefined, { following: true });
});

export const toggleCompanyFollowAction = callAction({ schema: z.object({ companyId: zId }), rateLimit: "follow" }, async ({ companyId }, { user }) => {
  const [company] = await db.select({ id: companies.id }).from(companies).where(and(eq(companies.id, companyId), eq(companies.status, "active"))).limit(1);
  if (!company) return fail("That organisation is not available.");
  const bump = (delta: number) =>
    db.update(companies).set({ followerCount: sql`greatest(${companies.followerCount} + ${delta}, 0)` }).where(eq(companies.id, companyId));

  const removed = await db.delete(companyFollows).where(and(eq(companyFollows.userId, user.id), eq(companyFollows.companyId, companyId))).returning({ id: companyFollows.companyId });
  if (removed.length > 0) {
    await bump(-1);
    return ok(undefined, { following: false });
  }
  const added = await db.insert(companyFollows).values({ userId: user.id, companyId }).onConflictDoNothing().returning({ id: companyFollows.companyId });
  if (added.length > 0) await bump(1);
  return ok(undefined, { following: true });
});

// ── Connections ──────────────────────────────────────────────────────────────

async function markConnected(a: string, b: string) {
  await Promise.all([bumpProfileCounter(a, "connectionCount", 1), bumpProfileCounter(b, "connectionCount", 1)]);
}

export const requestConnectionAction = formAction(
  { schema: z.object({ userId: zId, note: zOptionalText(300) }), rateLimit: "connection" },
  async ({ userId, note }, { user }) => {
    if (userId === user.id) return fail("You cannot connect with yourself.");
    const target = await activeMember(userId);
    if (!target) return fail("That member is not available.");

    const key = pairKey(user.id, userId);
    const [existing] = await db.select().from(connections).where(eq(connections.pairKey, key)).limit(1);
    const invite = () =>
      notify({
        userId,
        actorId: user.id,
        type: "connection_request",
        entityType: "user",
        entityId: user.id,
        data: { title: `${user.name} wants to connect`, preview: note, href: "/network?tab=requests" },
      });

    if (!existing) {
      const inserted = await db.insert(connections).values({ requesterId: user.id, addresseeId: userId, pairKey: key, note: note ?? null }).onConflictDoNothing().returning({ id: connections.id });
      if (inserted.length > 0) await invite();
      return ok("Connection request sent.");
    }
    if (existing.status === "accepted") return ok("You are already connected.");
    if (existing.status === "pending") {
      if (existing.requesterId === user.id) return ok("Your request is waiting for a response.");
      // They had already asked: sending a request back is an acceptance.
      await db.update(connections).set({ status: "accepted", respondedAt: new Date() }).where(eq(connections.id, existing.id));
      await markConnected(user.id, userId);
      await notify({ userId, actorId: user.id, type: "connection_accepted", entityType: "user", entityId: user.id, data: { title: `${user.name} accepted your connection request`, href: `/u/${user.username}` } });
      return ok(`You are now connected with ${target.name}.`);
    }
    // Declined earlier: the person who was turned down must wait before asking again.
    if (existing.requesterId === user.id && existing.respondedAt && Date.now() - existing.respondedAt.getTime() < 30 * DAY) {
      return fail("You can send this member another request later.");
    }
    await db
      .update(connections)
      .set({ requesterId: user.id, addresseeId: userId, status: "pending", note: note ?? null, createdAt: new Date(), respondedAt: null })
      .where(eq(connections.id, existing.id));
    await invite();
    return ok("Connection request sent.");
  },
);

export const respondConnectionAction = callAction({ schema: z.object({ id: zId, accept: z.boolean() }), rateLimit: "connection" }, async ({ id, accept }, { user }) => {
  const [updated] = await db
    .update(connections)
    .set({ status: accept ? "accepted" : "declined", respondedAt: new Date() })
    .where(and(eq(connections.id, id), eq(connections.addresseeId, user.id), eq(connections.status, "pending")))
    .returning({ requesterId: connections.requesterId });
  if (!updated) return fail("That request is no longer pending.");
  if (!accept) return ok("Request declined.");
  await markConnected(user.id, updated.requesterId);
  await notify({
    userId: updated.requesterId,
    actorId: user.id,
    type: "connection_accepted",
    entityType: "user",
    entityId: user.id,
    data: { title: `${user.name} accepted your connection request`, href: `/u/${user.username}` },
  });
  return ok("Connection accepted.");
});

/** Removes a connection, or withdraws a request the caller sent. */
export const removeConnectionAction = callAction({ schema: z.object({ id: zId }), rateLimit: "connection" }, async ({ id }, { user }) => {
  const [row] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.id, id), or(eq(connections.requesterId, user.id), eq(connections.addresseeId, user.id))))
    .limit(1);
  if (!row) return fail("That connection could not be found.");
  if (row.status === "pending" && row.requesterId !== user.id) return fail("Use Decline to respond to this request.");
  await db.delete(connections).where(eq(connections.id, id));
  if (row.status === "accepted") {
    await Promise.all([bumpProfileCounter(row.requesterId, "connectionCount", -1), bumpProfileCounter(row.addresseeId, "connectionCount", -1)]);
    return ok("Connection removed.");
  }
  return ok("Request withdrawn.");
});

// ── Messages ─────────────────────────────────────────────────────────────────

const messageSchema = z.object({ conversationId: zOptionalId, recipientId: zOptionalId, body: zText(LIMITS.messageBody) });

/**
 * Sends a direct message. Starting a conversation is subject to the recipient's message
 * policy; replying inside an existing conversation is always allowed for its participants.
 */
export type SentMessage = { conversationId: string; isNew: boolean; message: MessageItem };

export const sendMessageAction = formAction<typeof messageSchema, SentMessage>({ schema: messageSchema, rateLimit: "message" }, async (input, { user }) => {
  let conversationId = input.conversationId;
  let recipientId: string;
  let isNew = false;

  if (conversationId) {
    const participants = await db.select({ userId: conversationParticipants.userId }).from(conversationParticipants).where(eq(conversationParticipants.conversationId, conversationId));
    if (!participants.some((p) => p.userId === user.id)) return fail("That conversation could not be found.");
    const other = participants.find((p) => p.userId !== user.id);
    if (!other) return fail("That conversation could not be found.");
    recipientId = other.userId;
  } else {
    if (!input.recipientId || input.recipientId === user.id) return fail("Choose who to message.");
    recipientId = input.recipientId;
  }

  const recipient = await activeMember(recipientId);
  if (!recipient) return fail("That member is no longer available.");

  const key = pairKey(user.id, recipientId);
  if (!conversationId) {
    const [existing] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pairKey, key)).limit(1);
    conversationId = existing?.id;
  }

  let recruiterOutreach = false;
  if (!conversationId) {
    const [connection] = await db.select({ status: connections.status }).from(connections).where(eq(connections.pairKey, key)).limit(1);
    const connected = connection?.status === "accepted";
    const policy = recipient.messagePolicy ?? "everyone";
    if (!can(user.role, "moderate:content")) {
      if (policy === "none") return fail(`${recipient.name} is not accepting new messages.`);
      if (policy === "connections" && !connected) return fail(`${recipient.name} only accepts messages from connections. Send a connection request first.`);
    }
    if (!user.emailVerified) return fail("Verify your email address before starting new conversations.");
    recruiterOutreach = !connected && (await isVerifiedRecruiter(user.id));

    const [created] = await db.insert(conversations).values({ pairKey: key }).onConflictDoNothing().returning({ id: conversations.id });
    if (created) {
      conversationId = created.id;
      isNew = true;
      await db.insert(conversationParticipants).values([
        { conversationId, userId: user.id, lastReadAt: new Date() },
        { conversationId, userId: recipientId },
      ]);
    } else {
      const [raced] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pairKey, key)).limit(1);
      conversationId = raced!.id;
    }
  }

  const now = new Date();
  const [message] = await db.insert(messages).values({ conversationId, senderId: user.id, body: input.body, createdAt: now }).returning();
  await db.update(conversations).set({ lastMessageAt: now, lastMessagePreview: excerptOf(input.body, 120) }).where(eq(conversations.id, conversationId));
  await db
    .update(conversationParticipants)
    .set({ lastReadAt: now })
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, user.id)));

  // One unread notification per conversation: further messages only raise the unread badge.
  const [pending] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, recipientId), eq(notifications.entityId, conversationId), isNull(notifications.readAt)))
    .limit(1);
  if (!pending) {
    await notify({
      userId: recipientId,
      actorId: user.id,
      type: recruiterOutreach ? "recruiter_message" : "message",
      entityType: "conversation",
      entityId: conversationId,
      data: { title: `New message from ${user.name}`, href: `/messages/${conversationId}` },
    });
  }

  const item: MessageItem = { id: message!.id, body: message!.body, createdAt: message!.createdAt, mine: true };
  return ok<SentMessage>(undefined, { conversationId, isNew, message: item });
});

/** Messages newer than `after`, for the open conversation. Also marks it read. */
export async function pollMessagesAction(conversationId: string, after: string): Promise<MessageItem[]> {
  const session = await getSession();
  const since = new Date(after);
  if (!session || !zId.safeParse(conversationId).success || Number.isNaN(since.getTime())) return [];
  const [participant] = await db
    .select({ userId: conversationParticipants.userId })
    .from(conversationParticipants)
    .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.user.id)))
    .limit(1);
  if (!participant) return [];
  const fresh = await getMessagesAfter(conversationId, session.user.id, since);
  if (fresh.some((m) => !m.mine)) {
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, session.user.id)));
  }
  return fresh;
}

// ── Notifications ────────────────────────────────────────────────────────────

export const markNotificationsReadAction = callAction({ schema: z.object({ id: zOptionalId, all: zBool.optional() }) }, async ({ id }, { user }) => {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined));
  return ok();
});

export const clearOldNotificationsAction = callAction({ schema: z.object({}) }, async (_input, { user }) => {
  await db.delete(notifications).where(and(eq(notifications.userId, user.id), lt(notifications.createdAt, new Date(Date.now() - 30 * DAY))));
  return ok("Notifications older than 30 days were removed.");
});
