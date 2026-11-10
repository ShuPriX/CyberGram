import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M16 5.5 25 10.6v10.8L16 26.5 7 21.4V10.6L16 5.5Z" className="stroke-primary-foreground" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="14.2" r="2.6" className="fill-primary-foreground" />
      <path d="M16 16.4v4.4" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", showName = true, className }: { href?: string; showName?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center gap-2 rounded-md", className)} aria-label={`${APP_NAME} home`}>
      <LogoMark />
      {showName ? <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span> : null}
    </Link>
  );
}
