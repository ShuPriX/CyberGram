import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** A prompt in a frame: the mark reads as "shell" at any size and needs only two colours. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn("size-7", className)}>
      <rect x="1" y="1" width="30" height="30" className="fill-background stroke-primary" strokeWidth="2" />
      <path d="m9 10 7 6-7 6" className="stroke-primary" strokeWidth="3" strokeLinecap="square" />
      <path d="M17 22h7" className="stroke-foreground" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

export function Logo({ href = "/", showName = true, className }: { href?: string; showName?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center gap-2.5", className)} aria-label={`${APP_NAME} home`}>
      <LogoMark />
      {showName ? (
        <span className="font-display text-[17px] font-bold uppercase leading-none tracking-[0.08em]">
          Cyber<span className="text-primary">Gram</span>
        </span>
      ) : null}
    </Link>
  );
}
