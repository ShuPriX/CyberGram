import { BriefcaseBusiness, Compass, House, Search, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isStaff } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadCounts } from "@/server/queries/notifications";
import { HeaderActions } from "./header-actions";
import { Logo } from "./logo";
import { NavLink, TabBarLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

const MEMBER_NAV = [
  { href: "/feed", label: "Feed" },
  { href: "/explore", label: "Explore" },
  { href: "/jobs", label: "Jobs" },
  { href: "/network", label: "Network" },
  { href: "/communities", label: "Communities" },
  { href: "/learn", label: "Learn" },
];

const VISITOR_NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/explore", label: "Explore" },
  { href: "/articles", label: "Articles" },
  { href: "/learn", label: "Learn" },
];

function HeaderSearch() {
  return (
    <form action="/search" method="get" role="search" className="relative hidden min-w-0 max-w-64 flex-1 lg:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      <input
        type="search"
        name="q"
        placeholder="Search people, jobs, posts…"
        aria-label="Search"
        maxLength={100}
        className="h-8 w-full rounded-md border border-transparent bg-secondary pl-8 pr-3 text-[13px] transition-colors placeholder:text-subtle hover:border-border-strong focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none"
      />
    </form>
  );
}

/** The single header used across marketing, public and member pages. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const counts = user ? await getUnreadCounts(user.id) : null;
  const nav = user ? MEMBER_NAV : VISITOR_NAV;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-2 px-4 sm:px-6 xl:px-10 sm:gap-3">
        <Logo href={user ? "/feed" : "/"} />
        <HeaderSearch />
        <nav aria-label="Primary" className="ml-1 hidden items-center gap-0.5 md:flex lg:ml-2">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <Link
            href="/search"
            aria-label="Search"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            <Search className="size-[18px]" />
          </Link>
          <ThemeToggle />
          {user && counts ? (
            <HeaderActions
              user={{
                username: user.username,
                name: user.name,
                headline: user.headline,
                avatarFileId: user.avatarFileId,
                isStaff: isStaff(user.role),
              }}
              initialCounts={counts}
            />
          ) : (
            <div className="ml-1 flex items-center gap-1.5">
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Join</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Bottom tab bar for small screens. Members only; visitors use the header links. */
export async function MobileTabBar() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
        <TabBarLink href="/jobs" label="Jobs" icon={<BriefcaseBusiness />} />
        <TabBarLink href="/explore" label="Explore" icon={<Compass />} />
        <TabBarLink href="/communities" label="Communities" icon={<UsersRound />} />
        <TabBarLink href="/login" label="Sign in" icon={<Users />} />
      </nav>
    );
  }
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <TabBarLink href="/feed" label="Feed" icon={<House />} />
      <TabBarLink href="/explore" label="Explore" icon={<Compass />} />
      <TabBarLink href="/jobs" label="Jobs" icon={<BriefcaseBusiness />} />
      <TabBarLink href="/network" label="Network" icon={<Users />} />
      <TabBarLink href="/communities" label="Groups" icon={<UsersRound />} />
    </nav>
  );
}
