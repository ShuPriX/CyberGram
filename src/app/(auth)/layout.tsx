import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
      <footer className="mx-auto flex w-full max-w-[1240px] flex-wrap justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-subtle">
        <Link href="/about" className="hover:text-foreground">About</Link>
        <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/contact" className="hover:text-foreground">Contact</Link>
      </footer>
    </div>
  );
}
