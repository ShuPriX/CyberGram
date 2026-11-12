import { desc, eq } from "drizzle-orm";
import { Inbox } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LinkTabs, PageHeader, TimeAgo } from "@/components/ui/misc";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { requireCapability } from "@/lib/auth/session";
import { privateMetadata } from "@/lib/seo";
import { markContactHandledAction } from "@/server/actions/admin";

export const metadata = privateMetadata("Contact inbox");

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireCapability("manage:users");
  const handled = (await searchParams).view === "handled";
  const rows = await db.select().from(contactMessages).where(eq(contactMessages.status, handled ? "handled" : "new")).orderBy(desc(contactMessages.createdAt)).limit(100);

  return (
    <>
      <PageHeader title="Contact inbox" description="Messages sent through the contact form. Reply from your support mailbox, then mark the message as handled." />
      <LinkTabs
        current={handled ? "handled" : "new"}
        items={[
          { value: "new", label: "New", href: "/admin/messages" },
          { value: "handled", label: "Handled", href: "/admin/messages?view=handled" },
        ]}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title={handled ? "No handled messages" : "Inbox zero"} />
        </Card>
      ) : (
        rows.map((message) => (
          <Card key={message.id}>
            <CardContent className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold">
                  {message.name} <span className="font-normal text-muted-foreground">· {message.email}</span>
                </p>
                <span className="flex items-center gap-2 text-xs text-subtle">
                  <Badge className="capitalize">{message.topic}</Badge>
                  <TimeAgo date={message.createdAt} />
                </span>
              </div>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{message.message}</p>
              {!handled ? (
                <div className="flex gap-2 border-t pt-3">
                  <ActionButton action={markContactHandledAction} input={{ id: message.id }} variant="outline" size="sm">
                    Mark as handled
                  </ActionButton>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
