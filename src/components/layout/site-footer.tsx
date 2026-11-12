import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { href: "/explore", label: "Explore cybersecurity" },
      { href: "/communities", label: "Communities" },
      { href: "/articles", label: "Technical articles" },
      { href: "/learn", label: "Learning & resources" },
      { href: "/companies", label: "Companies" },
    ],
  },
  {
    title: "Jobs",
    links: [
      { href: "/jobs", label: "All cybersecurity jobs" },
      { href: "/cybersecurity-jobs/india", label: "Jobs in India" },
      { href: "/cybersecurity-jobs/usa", label: "Jobs in the USA" },
      { href: "/cybersecurity-jobs/remote", label: "Remote jobs" },
      { href: "/cybersecurity-jobs/internships", label: "Internships" },
      { href: "/cybersecurity-jobs/entry-level", label: "Entry-level jobs" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-[1760px] gap-10 px-4 sm:px-6 xl:px-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            A professional network and career platform built exclusively for the cybersecurity community.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-subtle">{column.title}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-[1760px] px-4 sm:px-6 xl:px-10 py-5 text-xs text-subtle">
          © {new Date().getUTCFullYear()} {APP_NAME}. Built for the people who defend, break and build secure systems.
        </p>
      </div>
    </footer>
  );
}

/** Compact legal links shown at the bottom of in-app side rails. */
export function MiniFooter({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn("flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-subtle", className)}>
      <Link href="/about" className="hover:text-foreground">About</Link>
      <Link href="/contact" className="hover:text-foreground">Contact</Link>
      <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
      <Link href="/terms" className="hover:text-foreground">Terms</Link>
      <span>© {new Date().getUTCFullYear()} {APP_NAME}</span>
    </nav>
  );
}
