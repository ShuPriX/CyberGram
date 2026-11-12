import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Users } from "lucide-react";
import Link from "next/link";
import { EntryDialog } from "@/components/shared/entry-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField, TextareaField } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader, Pager } from "@/components/ui/misc";
import { db } from "@/db";
import { users } from "@/db/schema";
import { assignableRoles, can, outranks } from "@/lib/auth/permissions";
import { requireCapability } from "@/lib/auth/session";
import { ROLE_LABELS, ROLES, type Role, type UserStatus } from "@/lib/constants";
import { privateMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/utils";
import { setUserRoleAction, setUserStatusAction } from "@/server/actions/admin";
import { likePattern } from "@/server/queries/jobs";

export const metadata = privateMetadata("Members");

const PAGE_SIZE = 40;
const STATUSES: UserStatus[] = ["active", "suspended", "deleted"];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const admin = await requireCapability("manage:users");
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80);
  const role = ROLES.find((r) => r === params.role);
  const status = STATUSES.find((s) => s === params.status);
  const page = Math.max(1, Number(params.page) || 1);

  const where: SQL[] = [];
  if (q) where.push(or(ilike(users.name, likePattern(q)), ilike(users.username, likePattern(q)), ilike(users.email, likePattern(q)))!);
  if (role) where.push(eq(users.role, role));
  if (status) where.push(eq(users.status, status));
  const rows = await db
    .select()
    .from(users)
    .where(and(...where))
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);
  const shown = rows.slice(0, PAGE_SIZE);
  const roles = assignableRoles(admin.role);
  const link = (target: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (role) query.set("role", role);
    if (status) query.set("status", status);
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `/admin/users?${text}` : "/admin/users";
  };

  return (
    <>
      <PageHeader title="Members" description="Search accounts, suspend or reactivate them, and — for super admins — assign staff roles. Every change is recorded in the audit log." />
      <form action="/admin/users" method="get" className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
        <Input name="q" type="search" defaultValue={q ?? ""} maxLength={80} placeholder="Name, handle or email" aria-label="Search members" />
        <Select name="role" defaultValue={role ?? ""} aria-label="Role">
          <option value="">Any role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>
          ))}
        </Select>
        <Button type="submit">Search</Button>
      </form>

      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No members match" />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Joined</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((member) => {
                const actionable = member.id !== admin.id && member.status !== "deleted" && outranks(admin.role, member.role);
                return (
                  <tr key={member.id}>
                    <td className="px-4 py-3">
                      <Link href={`/u/${member.username}`} className="font-semibold hover:text-primary">{member.name}</Link>
                      {member.isDemo ? <Badge variant="warning" className="ml-1.5">Demo</Badge> : null}
                      <p className="text-xs text-muted-foreground">
                        @{member.username} · {member.email}
                        {member.emailVerifiedAt ? "" : " (unverified)"}
                      </p>
                      {member.statusReason ? <p className="mt-0.5 text-xs text-destructive">{member.statusReason}</p> : null}
                    </td>
                    <td className="px-3 py-3">{ROLE_LABELS[member.role as Role]}</td>
                    <td className="px-3 py-3">
                      <Badge variant={member.status === "active" ? "success" : member.status === "suspended" ? "danger" : "neutral"} className="capitalize">{member.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatDate(member.createdAt)}</td>
                    <td className="px-4 py-3">
                      {actionable ? (
                        <div className="flex justify-end gap-1.5">
                          {member.status === "active" ? (
                            <EntryDialog trigger="Suspend" variant="destructive-ghost" buttonSize="xs" title={`Suspend ${member.name}`} description="They are signed out everywhere and cannot sign in until reactivated. Their content is hidden." action={setUserStatusAction} submitLabel="Suspend account" submitVariant="destructive" size="sm">
                              <input type="hidden" name="userId" value={member.id} />
                              <input type="hidden" name="status" value="suspended" />
                              <TextareaField label="Reason" name="reason" required rows={3} maxLength={500} hint="Recorded in the audit log." />
                            </EntryDialog>
                          ) : (
                            <EntryDialog trigger="Reactivate" variant="outline" buttonSize="xs" title={`Reactivate ${member.name}`} action={setUserStatusAction} submitLabel="Reactivate" size="sm">
                              <input type="hidden" name="userId" value={member.id} />
                              <input type="hidden" name="status" value="active" />
                              <p className="text-[13px] text-muted-foreground">The member will be able to sign in again and their content becomes visible.</p>
                            </EntryDialog>
                          )}
                          {can(admin.role, "manage:roles") && roles.length > 0 ? (
                            <EntryDialog trigger="Role" variant="outline" buttonSize="xs" title={`Change role for ${member.name}`} description="The member is signed out so the new role applies from their next sign-in." action={setUserRoleAction} submitLabel="Update role" size="sm">
                              <input type="hidden" name="userId" value={member.id} />
                              <SelectField label="Role" name="role" options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} defaultValue={roles.includes(member.role) ? member.role : "user"} />
                            </EntryDialog>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-right text-xs text-subtle">{member.id === admin.id ? "You" : "—"}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <Pager prevHref={page > 1 ? link(page - 1) : null} nextHref={rows.length > PAGE_SIZE ? link(page + 1) : null} />
    </>
  );
}
