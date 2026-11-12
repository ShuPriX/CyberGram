import {
  AtSign,
  Award,
  Bell,
  BriefcaseBusiness,
  Building2,
  Heart,
  MessageCircle,
  MessageSquare,
  Repeat2,
  ShieldAlert,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LinkTabs, PageHeader, Pager, TimeAgo } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import type { NotificationType } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { cn, safeRedirectPath } from "@/lib/utils";
import { markNotificationsReadAction } from "@/server/actions/network";
import { listNotifications } from "@/server/queries/notifications";

export const metadata = privateMetadata("Notifications");

const ICONS: Record<NotificationType, LucideIcon> = {
  like: Heart,
  comment: MessageCircle,
  reply: MessageCircle,
  repost: Repeat2,
  mention: AtSign,
  achievement: Award,
  follow: UserPlus,
  connection_request: UserPlus,
  connection_accepted: UserCheck,
  message: MessageSquare,
  recruiter_message: MessageSquare,
  application_update: BriefcaseBusiness,
  new_applicant: BriefcaseBusiness,
  job_alert: BriefcaseBusiness,
  company_post: Building2,
  system: ShieldAlert,
};

const PAGE_SIZE = 30;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string; before?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const beforeMs = Number(params.before);
  const before = Number.isFinite(beforeMs) && beforeMs > 0 ? new Date(beforeMs) : undefined;
  const items = await listNotifications(user.id, { unreadOnly, before, limit: PAGE_SIZE + 1 });
  const page = items.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const base = unreadOnly ? "/notifications?filter=unread" : "/notifications";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Notifications"
        action={
          <>
            <ActionButton action={markNotificationsReadAction} input={{}} variant="outline" size="sm">
              Mark all as read
            </ActionButton>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/notifications">Preferences</Link>
            </Button>
          </>
        }
      />
      <LinkTabs
        current={unreadOnly ? "unread" : "all"}
        items={[
          { value: "all", label: "All", href: "/notifications" },
          { value: "unread", label: "Unread", href: "/notifications?filter=unread" },
        ]}
      />
      <Card className="overflow-hidden">
        {page.length === 0 ? (
          <EmptyState icon={Bell} title={unreadOnly ? "You are all caught up" : "No notifications yet"} description="Likes, comments, connection requests, messages and job updates will appear here." />
        ) : (
          <ul className="divide-y">
            {page.map((item) => {
              const Icon = ICONS[item.type] ?? Bell;
              const href = safeRedirectPath(item.data.href, "/notifications");
              return (
                <li key={item.id} className={cn("relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent", !item.readAt && "bg-primary-soft/40")}>
                  <div className="relative shrink-0">
                    {item.actor ? (
                      <Avatar name={item.actor.name} fileId={item.actor.avatarFileId} />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                        <Icon className="size-[18px]" aria-hidden="true" />
                      </span>
                    )}
                    {item.actor ? (
                      <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border bg-card text-primary">
                        <Icon className="size-3" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="text-[13.5px] font-medium leading-snug after:absolute after:inset-0">
                      {item.data.title ?? "Notification"}
                    </Link>
                    {item.data.preview ? <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{item.data.preview}</p> : null}
                    <TimeAgo date={item.createdAt} className="mt-0.5 block text-xs text-subtle" />
                  </div>
                  {!item.readAt ? (
                    <ActionButton action={markNotificationsReadAction} input={{ id: item.id }} variant="ghost" size="xs" className="relative z-10 shrink-0 text-muted-foreground">
                      Mark read
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Pager
        prevHref={before ? base : null}
        nextHref={items.length > PAGE_SIZE && last ? `${base}${base.includes("?") ? "&" : "?"}before=${last.createdAt.getTime()}` : null}
      />
    </div>
  );
}
