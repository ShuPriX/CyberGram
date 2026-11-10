import type { Role } from "@/lib/constants";

/**
 * Role-based access control.
 *
 * Platform roles are coarse and hierarchical for staff (moderator < admin < super_admin).
 * `recruiter` marks members who act for an organisation; what they may do for a specific
 * company is always decided by `company_members`, never by the role alone.
 */
export const CAPABILITIES = [
  "admin:access", // may open the admin area at all
  "moderate:content", // posts, comments, reports
  "moderate:jobs", // review queue for imported / community / flagged listings
  "moderate:submissions", // events, learning resources
  "verify:achievements",
  "manage:users", // suspend, reactivate
  "verify:companies",
  "manage:sources", // job feeds and synchronisation
  "manage:categories",
  "view:analytics",
  "view:audit",
  "manage:roles", // grant or revoke staff roles
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const MODERATOR: Capability[] = [
  "admin:access",
  "moderate:content",
  "moderate:jobs",
  "moderate:submissions",
  "verify:achievements",
];
const ADMIN: Capability[] = [
  ...MODERATOR,
  "manage:users",
  "verify:companies",
  "manage:sources",
  "manage:categories",
  "view:analytics",
  "view:audit",
];

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  user: new Set(),
  recruiter: new Set(),
  moderator: new Set(MODERATOR),
  admin: new Set(ADMIN),
  super_admin: new Set([...ADMIN, "manage:roles"]),
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export function isStaff(role: Role | null | undefined): boolean {
  return can(role, "admin:access");
}

const RANK: Record<Role, number> = { user: 0, recruiter: 0, moderator: 1, admin: 2, super_admin: 3 };

/**
 * Staff may only act on accounts ranked strictly below them, so a moderator can never
 * suspend an admin and admins cannot act on each other.
 */
export function outranks(actor: Role, target: Role): boolean {
  return RANK[actor] > RANK[target];
}

/** Roles an actor is allowed to assign. Only super admins can create other staff. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "super_admin") return ["user", "recruiter", "moderator", "admin"];
  return [];
}
