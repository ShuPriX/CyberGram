"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RichText } from "@/components/shared/rich-text";
import { ActionForm, FormError, SubmitButton } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { LIMITS } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { pollMessagesAction, sendMessageAction, type SentMessage } from "@/server/actions/network";
import type { MessageItem } from "@/server/queries/messages";

const POLL_MS = 5000;
const dayKey = (date: Date) => new Date(date).toISOString().slice(0, 10);
const clock = (date: Date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * An open conversation. New messages are fetched every few seconds while the tab is visible;
 * message text is rendered through RichText, so nothing in it is treated as markup.
 */
export function MessageThread({
  conversationId,
  recipientId,
  initial,
  canReply,
  disabledReason,
}: {
  conversationId?: string;
  recipientId?: string;
  initial: MessageItem[];
  canReply: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef(initial.at(-1)?.createdAt ?? new Date(0));

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items.length]);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const fresh = await pollMessagesAction(conversationId, new Date(latest.current).toISOString());
        if (cancelled || fresh.length === 0) return;
        latest.current = fresh.at(-1)!.createdAt;
        setItems((current) => {
          const seen = new Set(current.map((m) => m.id));
          return [...current, ...fresh.filter((m) => !seen.has(m.id))];
        });
      } catch {
        /* offline — try again on the next tick */
      }
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [conversationId]);

  function onSent(data: SentMessage | undefined) {
    if (!data) return;
    setDraft("");
    if (!conversationId) return router.replace(`/messages/${data.conversationId}`);
    latest.current = data.message.createdAt;
    setItems((current) => (current.some((m) => m.id === data.message.id) ? current : [...current, data.message]));
    router.refresh();
  }

  return (
    <>
      <div className="scrollbar-thin flex-1 space-y-1.5 overflow-y-auto px-4 py-4" aria-live="polite">
        {items.length === 0 ? <p className="py-10 text-center text-[13px] text-muted-foreground">No messages yet. Say hello.</p> : null}
        {items.map((message, index) => {
          const previous = items[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
          return (
            <div key={message.id}>
              {newDay ? <p className="my-3 text-center text-[11px] font-medium uppercase tracking-wider text-subtle">{formatDate(message.createdAt, "medium")}</p> : null}
              <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2", message.mine ? "rounded-br-md bg-primary-soft text-primary-soft-foreground" : "rounded-bl-md bg-muted")}>
                  <RichText text={message.body} className="text-[14px] leading-relaxed" />
                  <p className="mt-0.5 text-right text-[10.5px] opacity-70" suppressHydrationWarning>
                    {clock(message.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {canReply ? (
        <ActionForm<SentMessage> action={sendMessageAction} onSuccess={onSent} className="border-t p-3">
          <FormError className="mb-2" />
          {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : <input type="hidden" name="recipientId" value={recipientId} />}
          <div className="flex items-end gap-2">
            <Textarea
              name="body"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (draft.trim()) event.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              required
              maxLength={LIMITS.messageBody}
              placeholder="Write a message…  Enter to send, Shift+Enter for a new line"
              aria-label="Message"
              className="max-h-40 min-h-9 flex-1 resize-none"
            />
            <SubmitButton size="icon" aria-label="Send" disabled={draft.trim().length === 0}>
              <Send />
            </SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="border-t px-4 py-3 text-center text-[13px] text-muted-foreground">{disabledReason ?? "You cannot reply to this conversation."}</p>
      )}
    </>
  );
}
