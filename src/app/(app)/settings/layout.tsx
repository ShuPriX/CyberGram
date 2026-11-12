import { Bell, Eye, KeyRound, UserRound } from "lucide-react";
import { SideLink } from "@/components/layout/nav-link";
import { requireUser } from "@/lib/auth/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        <SideLink href="/settings" exact icon={<UserRound />}>Account</SideLink>
        <SideLink href="/settings/privacy" icon={<Eye />}>Privacy</SideLink>
        <SideLink href="/settings/notifications" icon={<Bell />}>Notifications</SideLink>
        <SideLink href="/settings/security" icon={<KeyRound />}>Security</SideLink>
      </nav>
      <div className="min-w-0 space-y-5">{children}</div>
    </div>
  );
}
