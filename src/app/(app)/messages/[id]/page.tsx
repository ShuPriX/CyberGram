import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MessagesShell } from "@/components/messages/shell";
import { MessageThread } from "@/components/messages/thread";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { getConversation, listConversations, markConversationRead } from "@/server/queries/messages";

export const metadata = privateMetadata("Messages");

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOnboardedUser();
  const { id } = await params;
  // Membership is checked inside getConversation: non-participants get a 404, not a hint.
  const data = await getConversation(id, user.id);
  if (!data) notFound();

  await Promise.all([
    markConversationRead(id, user.id),
    db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), eq(notifications.entityId, id), isNull(notifications.readAt))),
  ]);
  const list = (await listConversations(user.id)).map((c) => (c.id === id ? { ...c, unread: false } : c));
  const { other } = data.conversation;

  return (
    <MessagesShell conversations={list} activeId={id} other={other}>
      <MessageThread key={id} conversationId={id} initial={data.messages} canReply={other.active} disabledReason="This member is no longer available." />
    </MessagesShell>
  );
}
