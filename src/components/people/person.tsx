"use client";

import { Check, Clock, MessageSquare, UserCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ActionForm, FormError, SubmitButton, TextareaField } from "@/components/ui/form";
import { removeConnectionAction, requestConnectionAction, respondConnectionAction, toggleFollowAction } from "@/server/actions/network";
import type { PersonCard, Relationship } from "@/server/queries/people";

export function FollowButton({ userId, following, size = "sm", ...props }: { userId: string; following: boolean } & Pick<ButtonProps, "size" | "className">) {
  return (
    <ActionButton action={toggleFollowAction} input={{ userId }} variant={following ? "outline" : "soft"} size={size} aria-pressed={following} {...props}>
      {following ? <Check /> : null}
      {following ? "Following" : "Follow"}
    </ActionButton>
  );
}

/** Connect / pending / accept / connected, depending on where the two members stand. */
export function ConnectButton({ userId, name, relationship, size = "sm" }: { userId: string; name: string; relationship: Relationship; size?: ButtonProps["size"] }) {
  const [open, setOpen] = useState(false);
  const { connection, connectionId } = relationship;

  if (connection === "connected" && connectionId) {
    return (
      <ActionButton action={removeConnectionAction} input={{ id: connectionId }} confirm={`Remove ${name} from your connections?`} variant="outline" size={size}>
        <UserCheck /> Connected
      </ActionButton>
    );
  }
  if (connection === "pending_sent" && connectionId) {
    return (
      <ActionButton action={removeConnectionAction} input={{ id: connectionId }} confirm="Withdraw your connection request?" variant="outline" size={size}>
        <Clock /> Pending
      </ActionButton>
    );
  }
  if (connection === "pending_received" && connectionId) {
    return (
      <span className="inline-flex gap-1.5">
        <ActionButton action={respondConnectionAction} input={{ id: connectionId, accept: true }} size={size}>
          Accept
        </ActionButton>
        <ActionButton action={respondConnectionAction} input={{ id: connectionId, accept: false }} variant="outline" size={size}>
          Decline
        </ActionButton>
      </span>
    );
  }
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <UserPlus /> Connect
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Connect with ${name}`} description="Connections can see each other's connections-only posts and message freely." size="sm">
          <ActionForm action={requestConnectionAction} refresh onSuccess={() => setOpen(false)} className="space-y-4">
            <FormError />
            <input type="hidden" name="userId" value={userId} />
            <TextareaField label="Add a note" name="note" optional rows={3} maxLength={300} placeholder="Say how you know them or why you would like to connect" />
            <div className="flex justify-end">
              <SubmitButton>Send request</SubmitButton>
            </div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MessageButton({ userId, size = "sm", variant = "outline" }: { userId: string } & Pick<ButtonProps, "size" | "variant">) {
  return (
    <Button asChild variant={variant} size={size}>
      <Link href={`/messages?to=${userId}`}>
        <MessageSquare /> Message
      </Link>
    </Button>
  );
}

/** A member in a list: avatar, name, headline and an optional trailing control. */
export function PersonRow({ person, action, note }: { person: PersonCard; action?: React.ReactNode; note?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Link href={`/u/${person.username}`} className="shrink-0">
        <Avatar name={person.name} fileId={person.avatarFileId} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${person.username}`} className="block truncate text-[13.5px] font-semibold hover:underline">
          {person.name}
        </Link>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{person.headline ?? `@${person.username}`}</p>
        {person.location ? <p className="mt-0.5 truncate text-xs text-subtle">{person.location}</p> : null}
        {note ? <p className="mt-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">“{note}”</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{action}</div> : null}
    </div>
  );
}
