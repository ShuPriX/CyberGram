import { and, count, eq } from "drizzle-orm";
import { Award, BriefcaseBusiness, Building2, Flag, Inbox, LayoutDashboard, ListChecks, RefreshCw, ScrollText, Tags, Users } from "lucide-react";
import { SideLink } from "@/components/layout/nav-link";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { achievements, companies, contactMessages, events, jobs, reports, resources } from "@/db/schema";
import { can, type Capability } from "@/lib/auth/permissions";
import { requireCapability } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/constants";

const one = async (query: Promise<{ value: number }[]>) => (await query)[0]?.value ?? 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Every admin page re-checks its own capability; this gate keeps non-staff out of the area entirely.
  const user = await requireCapability("admin:access");
  const [openReports, jobQueue, companyQueue, achievementQueue, eventQueue, resourceQueue, inbox] = await Promise.all([
    one(db.select({ value: count() }).from(reports).where(eq(reports.status, "open"))),
    one(db.select({ value: count() }).from(jobs).where(eq(jobs.status, "pending_review"))),
    one(db.select({ value: count() }).from(companies).where(eq(companies.verificationStatus, "pending"))),
    one(db.select({ value: count() }).from(achievements).where(eq(achievements.verificationStatus, "pending"))),
    one(db.select({ value: count() }).from(events).where(eq(events.status, "pending"))),
    one(db.select({ value: count() }).from(resources).where(and(eq(resources.status, "pending")))),
    one(db.select({ value: count() }).from(contactMessages).where(eq(contactMessages.status, "new"))),
  ]);

  const items: { href: string; label: string; icon: React.ReactNode; capability: Capability; count?: number; exact?: boolean }[] = [
    { href: "/admin", label: "Overview", icon: <LayoutDashboard />, capability: "admin:access", exact: true },
    { href: "/admin/reports", label: "Reports", icon: <Flag />, capability: "moderate:content", count: openReports },
    { href: "/admin/jobs", label: "Job review", icon: <BriefcaseBusiness />, capability: "moderate:jobs", count: jobQueue },
    { href: "/admin/achievements", label: "Achievements", icon: <Award />, capability: "verify:achievements", count: achievementQueue },
    { href: "/admin/submissions", label: "Submissions", icon: <ListChecks />, capability: "moderate:submissions", count: eventQueue + resourceQueue },
    { href: "/admin/companies", label: "Organisations", icon: <Building2 />, capability: "verify:companies", count: companyQueue },
    { href: "/admin/sources", label: "Job sources", icon: <RefreshCw />, capability: "manage:sources" },
    { href: "/admin/users", label: "Members", icon: <Users />, capability: "manage:users" },
    { href: "/admin/messages", label: "Contact inbox", icon: <Inbox />, capability: "manage:users", count: inbox },
    { href: "/admin/categories", label: "Categories", icon: <Tags />, capability: "manage:categories" },
    { href: "/admin/audit", label: "Audit log", icon: <ScrollText />, capability: "view:audit" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[210px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <p className="px-2.5 text-xs text-subtle">
          Signed in as <span className="font-medium text-foreground">{ROLE_LABELS[user.role]}</span>
        </p>
        <nav aria-label="Administration" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {items
            .filter((item) => can(user.role, item.capability))
            .map((item) => (
              <SideLink key={item.href} href={item.href} icon={item.icon} exact={item.exact} trailing={item.count ? <Badge variant="warning">{item.count}</Badge> : undefined}>
                {item.label}
              </SideLink>
            ))}
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}
