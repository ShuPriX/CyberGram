"use client";

import {
  Award,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  FileText,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import type { UnreadCounts } from "@/server/queries/notifications";

const POLL_INTERVAL_MS = 30_000;

/**
 * Keeps the notification and message badges current. Polls a small JSON endpoint while the
 * tab is visible, and immediately when the member returns to it or navigates.
 */
function useUnreadCounts(initial: UnreadCounts): UnreadCounts {
  const [counts, setCounts] = useState(initial);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/me/summary", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const next = (await res.json()) as UnreadCounts;
        if (!cancelled) setCounts(next);
      } catch {
        /* offline — keep the last known counts */
      }
    };
    void refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pathname]);

  return counts;
}

function IconLink({ href, label, count, children }: { href: string; label: string; count: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label} (${count} unread)` : label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground",
        active ? "bg-accent text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
      {count > 0 ? (
        <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export type HeaderUser = {
  username: string;
  name: string;
  headline: string | null;
  avatarFileId: string | null;
  isStaff: boolean;
};

export function HeaderActions({ user, initialCounts }: { user: HeaderUser; initialCounts: UnreadCounts }) {
  const counts = useUnreadCounts(initialCounts);

  return (
    <>
      <IconLink href="/messages" label="Messages" count={counts.messages}>
        <MessageSquare className="size-[18px]" />
      </IconLink>
      <IconLink href="/notifications" label="Notifications" count={counts.notifications}>
        <Bell className="size-[18px]" />
      </IconLink>

      <DropdownMenu>
        <DropdownMenuTrigger className="ml-1 rounded-full" aria-label="Account menu">
          <Avatar name={user.name} fileId={user.avatarFileId} size="sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-[13px] font-semibold text-foreground">{user.name}</span>
            <span className="truncate font-normal">{user.headline ?? `@${user.username}`}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/u/${user.username}`}>
              <UserRound /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/achievements">
              <Award /> Achievements
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/bookmarks">
              <Bookmark /> Bookmarks
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/articles/new">
              <FileText /> Write an article
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/jobs/applications">
              <BriefcaseBusiness /> My applications
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/recruiter">
              <Building2 /> Recruiter portal
            </Link>
          </DropdownMenuItem>
          {user.isStaff ? (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck /> Admin
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings /> Settings &amp; privacy
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startTransition(() => void logoutAction())}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
