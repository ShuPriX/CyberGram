import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { MessagesShell } from "@/components/messages/shell";
import { MessageThread } from "@/components/messages/thread";
import { db } from "@/db";
import { conversations, profiles, users } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { listConversations } from "@/server/queries/messages";
import { pairKey } from "@/server/queries/people";

export const metadata = privateMetadata("Messages");

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const user = await requireOnboardedUser();
  const { to } = await searchParams;
  const list = await listConversations(user.id);

  if (!to || !/^[a-z0-9]{8,40}$/.test(to) || to === user.id) return <MessagesShell conversations={list} />;

  // Starting a conversation from a profile: reuse the existing thread when there is one.
  const [existing] = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.pairKey, pairKey(user.id, to))).limit(1);
  if (existing) redirect(`/messages/${existing.id}`);

  const [recipient] = await db
    .select({ id: users.id, username: users.username, name: users.name, headline: profiles.headline, avatarFileId: profiles.avatarFileId, messagePolicy: profiles.messagePolicy })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, to), eq(users.status, "active")))
    .limit(1);
  if (!recipient) return <MessagesShell conversations={list} />;

  return (
    <MessagesShell conversations={list} other={recipient}>
      <MessageThread
        recipientId={recipient.id}
        initial={[]}
        canReply={recipient.messagePolicy !== "none"}
        disabledReason={`${recipient.name} is not accepting new messages.`}
      />
    </MessagesShell>
  );
}
