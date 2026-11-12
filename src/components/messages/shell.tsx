import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ReportButton } from "@/components/profile/profile-report";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState, TimeAgo } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { ConversationListItem } from "@/server/queries/messages";

type Other = { id: string; username: string; name: string; headline: string | null; avatarFileId: string | null };

/** Two-pane messaging layout. On small screens only one pane is shown at a time. */
export function MessagesShell({
  conversations,
  activeId,
  other,
  children,
}: {
  conversations: ConversationListItem[];
  activeId?: string;
  /** The person on the other side of the open (or about to be started) conversation. */
  other?: Other;
  children?: React.ReactNode;
}) {
  const open = Boolean(other);
  return (
    <Card className="grid h-[calc(100dvh-11rem)] min-h-[440px] overflow-hidden md:h-[calc(100dvh-7.5rem)] md:grid-cols-[320px_minmax(0,1fr)]">
      <div className={cn("flex min-h-0 flex-col border-r", open && "hidden md:flex")}>
        <h1 className="border-b px-4 py-3.5 text-[15px] font-semibold">Messages</h1>
        {conversations.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No conversations yet" description="Open a member's profile and choose Message to start one." className="flex-1" />
        ) : (
          <ul className="scrollbar-thin flex-1 overflow-y-auto">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  aria-current={conversation.id === activeId ? "page" : undefined}
                  className={cn("flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-accent", conversation.id === activeId && "bg-accent")}
                >
                  <Avatar name={conversation.other.name} fileId={conversation.other.avatarFileId} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[13.5px]", conversation.unread ? "font-semibold" : "font-medium")}>{conversation.other.name}</span>
                      <TimeAgo date={conversation.lastMessageAt} className="shrink-0 text-[11px] text-subtle" />
                    </span>
                    <span className={cn("block truncate text-xs", conversation.unread ? "text-foreground" : "text-muted-foreground")}>{conversation.preview ?? "No messages yet"}</span>
                  </span>
                  {conversation.unread ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn("flex min-h-0 flex-col", !open && "hidden md:flex")}>
        {other ? (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-2.5">
              <Link href="/messages" className="-ml-1.5 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden" aria-label="Back to conversations">
                <ArrowLeft className="size-4" />
              </Link>
              <Link href={`/u/${other.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={other.name} fileId={other.avatarFileId} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold hover:underline">{other.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{other.headline ?? `@${other.username}`}</span>
                </span>
              </Link>
              <ReportButton targetType="user" targetId={other.id} label="Report this member" />
            </div>
            {children}
          </>
        ) : (
          <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a conversation on the left, or message someone from their profile." className="flex-1" />
        )}
      </div>
    </Card>
  );
}
