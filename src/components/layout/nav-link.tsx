"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { cn } from "@/lib/utils";

function useIsActive(href: string, exact = false) {
  const pathname = usePathname();
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Text link for the desktop header. */
export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const active = useIsActive(href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Icon + label tab for the mobile bottom bar. */
export function TabBarLink({ href, label, icon, badge }: { href: string; label: string; icon: React.ReactNode; badge?: number }) {
  const active = useIsActive(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium transition-colors [&_svg]:size-5",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      {label}
    </Link>
  );
}

/** Row link for sidebars and settings navigation. */
export function SideLink({
  href,
  children,
  icon,
  exact,
  trailing,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  exact?: boolean;
  trailing?: React.ReactNode;
}) {
  const active = useIsActive(href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-accent text-foreground [&_svg]:text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Link>
  );
}
