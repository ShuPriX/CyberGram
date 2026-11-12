"use server";

import { and, eq, ilike, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { achievements, companies, educations, experiences, oauthAccounts, profiles, projects, sessions, users } from "@/db/schema";
import { checkPasswordPolicy, hashPassword, isPasswordBreached, verifyPassword } from "@/lib/auth/password";
import { destroyCurrentSession, revokeUserSessions } from "@/lib/auth/session";
import {
  ACHIEVEMENT_TYPE_VALUES,
  EMPLOYMENT_TYPE_VALUES,
  LIMITS,
  MESSAGE_POLICIES,
  NOTIFICATION_TYPES,
  OPEN_TO_WORK_VISIBILITIES,
  PROFILE_VISIBILITIES,
  WORK_ARRANGEMENT_VALUES,
  type NotificationPrefs,
} from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { emails } from "@/lib/mail/templates";
import { audit } from "@/lib/security/audit";
import { likePattern } from "@/server/queries/jobs";
import {
  zBool,
  zCountry,
  zCsv,
  zDateString,
  zDisplayName,
  zId,
  zInline,
  zManyOf,
  zOneOf,
  zOptionalDateString,
  zOptionalId,
  zOptionalInline,
  zOptionalInt,
  zOptionalOneOf,
  zOptionalText,
  zOptionalUrl,
  zPassword,
  zSkills,
  zStringList,
  zUsername,
} from "@/lib/validation";
import { callAction, fail, formAction, isUniqueViolation, ok } from "@/server/action-utils";
import { getActiveCategories } from "@/server/queries/taxonomy";
import { ownedFileId } from "@/server/services/access";

const values = <T extends { value: string }>(items: readonly T[]) => items.map((i) => i.value) as [T["value"], ...T["value"][]];

async function validDomains(input: string[]): Promise<string[]> {
  const known = new Set((await getActiveCategories()).map((c) => c.slug));
  return input.filter((slug) => known.has(slug));
}

// ── Onboarding ───────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  headline: zInline(LIMITS.headline, 3),
  currentTitle: zOptionalInline(100),
  currentCompany: zOptionalInline(100),
  location: zOptionalInline(100),
  country: zCountry,
  yearsExperience: zOptionalInt(0, 60),
  domains: zStringList(8, 60),
  skills: zSkills(LIMITS.skillsPerProfile),
  openToWork: zBool,
});

export const completeOnboardingAction = formAction({ schema: onboardingSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const domains = await validDomains(input.domains);
  if (domains.length === 0) return fail("Choose at least one area you work in or want to follow.", { domains: "Choose at least one." });
  const profile = { ...input, domains };
  await db.insert(profiles).values({ userId: user.id, ...profile }).onConflictDoUpdate({ target: profiles.userId, set: profile });
  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  redirect("/feed");
});

// ── Profile ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: zDisplayName,
  username: zUsername,
  headline: zOptionalInline(LIMITS.headline),
  bio: zOptionalText(LIMITS.bio),
  currentTitle: zOptionalInline(100),
  currentCompany: zOptionalInline(100),
  location: zOptionalInline(100),
  country: zCountry,
  yearsExperience: zOptionalInt(0, 60),
  website: zOptionalUrl,
  githubUrl: zOptionalUrl,
  linkedinUrl: zOptionalUrl,
  twitterUrl: zOptionalUrl,
  domains: zStringList(8, 60),
  skills: zSkills(LIMITS.skillsPerProfile),
  avatarFileId: zOptionalId,
  coverFileId: zOptionalId,
  openToWork: zBool,
  openToWorkVisibility: zOneOf(values(OPEN_TO_WORK_VISIBILITIES)).default("recruiters"),
  preferredEmploymentTypes: zManyOf(EMPLOYMENT_TYPE_VALUES),
  preferredArrangements: zManyOf(WORK_ARRANGEMENT_VALUES),
  preferredLocations: zCsv(10, 80),
});

export const updateProfileAction = formAction({ schema: profileSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { name, username, avatarFileId, coverFileId, ...rest } = input;
  const [avatar, cover, domains] = await Promise.all([
    ownedFileId(user.id, avatarFileId, "avatar"),
    ownedFileId(user.id, coverFileId, "cover"),
    validDomains(input.domains),
  ]);

  try {
    await db.update(users).set({ name, username }).where(eq(users.id, user.id));
  } catch (err) {
    if (isUniqueViolation(err)) return fail("That handle is already taken.", { username: "That handle is already taken." });
    throw err;
  }
  const nullable = {
    headline: rest.headline ?? null,
    bio: rest.bio ?? null,
    currentTitle: rest.currentTitle ?? null,
    currentCompany: rest.currentCompany ?? null,
    location: rest.location ?? null,
    country: rest.country ?? null,
    yearsExperience: rest.yearsExperience ?? null,
    website: rest.website ?? null,
    githubUrl: rest.githubUrl ?? null,
    linkedinUrl: rest.linkedinUrl ?? null,
    twitterUrl: rest.twitterUrl ?? null,
  };
  await db
    .update(profiles)
    .set({
      ...nullable,
      domains,
      skills: rest.skills,
      avatarFileId: avatar,
      coverFileId: cover,
      openToWork: rest.openToWork,
      openToWorkVisibility: rest.openToWorkVisibility,
      preferredEmploymentTypes: rest.preferredEmploymentTypes,
      preferredArrangements: rest.preferredArrangements,
      preferredLocations: rest.preferredLocations,
    })
    .where(eq(profiles.userId, user.id));

  if (username !== user.username) await audit("profile.username_changed", { actorId: user.id, targetType: "user", targetId: user.id, metadata: { from: user.username, to: username } });
  revalidatePath(`/u/${username}`);
  redirect(`/u/${username}`);
});

// ── Experience, education, projects ──────────────────────────────────────────

const experienceSchema = z
  .object({
    id: zOptionalId,
    title: zInline(120),
    company: zInline(120),
    employmentType: zOptionalOneOf(EMPLOYMENT_TYPE_VALUES),
    location: zOptionalInline(100),
    startDate: zDateString,
    endDate: zOptionalDateString,
    isCurrent: zBool,
    description: zOptionalText(2000),
  })
  .refine((v) => v.isCurrent || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "The end date is before the start date." });

export const saveExperienceAction = formAction({ schema: experienceSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { id, ...fields } = input;
  // Link to the organisation's page when the name matches one exactly.
  const [company] = await db.select({ id: companies.id }).from(companies).where(ilike(companies.name, likePattern(fields.company).slice(1, -1))).limit(1);
  const row = {
    ...fields,
    employmentType: fields.employmentType ?? null,
    location: fields.location ?? null,
    description: fields.description ?? null,
    endDate: fields.isCurrent ? null : (fields.endDate ?? null),
    companyId: company?.id ?? null,
  };
  if (id) {
    const updated = await db.update(experiences).set(row).where(and(eq(experiences.id, id), eq(experiences.userId, user.id))).returning({ id: experiences.id });
    if (updated.length === 0) return fail("That entry could not be found.");
  } else {
    await db.insert(experiences).values({ userId: user.id, ...row });
  }
  return ok("Experience saved.");
});

const educationSchema = z
  .object({
    id: zOptionalId,
    school: zInline(140),
    degree: zOptionalInline(120),
    field: zOptionalInline(120),
    startYear: zOptionalInt(1950, 2100),
    endYear: zOptionalInt(1950, 2100),
    description: zOptionalText(1000),
  })
  .refine((v) => !v.startYear || !v.endYear || v.endYear >= v.startYear, { path: ["endYear"], message: "The end year is before the start year." });

export const saveEducationAction = formAction({ schema: educationSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { id, ...fields } = input;
  const row = {
    school: fields.school,
    degree: fields.degree ?? null,
    field: fields.field ?? null,
    startYear: fields.startYear ?? null,
    endYear: fields.endYear ?? null,
    description: fields.description ?? null,
  };
  if (id) {
    const updated = await db.update(educations).set(row).where(and(eq(educations.id, id), eq(educations.userId, user.id))).returning({ id: educations.id });
    if (updated.length === 0) return fail("That entry could not be found.");
  } else {
    await db.insert(educations).values({ userId: user.id, ...row });
  }
  return ok("Education saved.");
});

const projectSchema = z.object({
  id: zOptionalId,
  name: zInline(120),
  description: zOptionalText(1500),
  repoUrl: zOptionalUrl,
  url: zOptionalUrl,
  tags: zCsv(8, 30),
});

export const saveProjectAction = formAction({ schema: projectSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { id, ...fields } = input;
  const row = { name: fields.name, description: fields.description ?? null, repoUrl: fields.repoUrl ?? null, url: fields.url ?? null, tags: fields.tags };
  if (id) {
    const updated = await db.update(projects).set(row).where(and(eq(projects.id, id), eq(projects.userId, user.id))).returning({ id: projects.id });
    if (updated.length === 0) return fail("That project could not be found.");
  } else {
    await db.insert(projects).values({ userId: user.id, ...row });
  }
  return ok("Project saved.");
});

const ITEM_TABLES = { experience: experiences, education: educations, project: projects, achievement: achievements } as const;

export const deleteProfileItemAction = callAction(
  { schema: z.object({ kind: zOneOf(["experience", "education", "project", "achievement"] as const), id: zId }), rateLimit: "profileWrite" },
  async ({ kind, id }, { user }) => {
    const table = ITEM_TABLES[kind];
    const removed = await db.delete(table).where(and(eq(table.id, id), eq(table.userId, user.id))).returning({ id: table.id });
    if (removed.length === 0) return fail("That entry could not be found.");
    return ok("Removed.");
  },
);

// ── Achievements ─────────────────────────────────────────────────────────────

const achievementSchema = z
  .object({
    id: zOptionalId,
    type: zOneOf(ACHIEVEMENT_TYPE_VALUES),
    title: zInline(160, 3),
    issuer: zOptionalInline(120),
    description: zOptionalText(1500),
    achievedOn: zOptionalDateString,
    expiresOn: zOptionalDateString,
    evidenceUrl: zOptionalUrl,
    rank: zOptionalInline(60),
    team: zOptionalInline(80),
    cveId: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().toUpperCase().regex(/^CVE-\d{4}-\d{4,7}$/, "Use the form CVE-2025-12345.").optional()),
    severity: zOptionalOneOf(["Low", "Medium", "High", "Critical"] as const),
    platform: zOptionalInline(60),
    credentialId: zOptionalInline(80),
    featured: zBool,
  })
  .refine((v) => !v.achievedOn || v.achievedOn <= new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), {
    path: ["achievedOn"],
    message: "This date is in the future.",
  });

export const saveAchievementAction = formAction({ schema: achievementSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { id, rank, team, cveId, severity, platform, credentialId, ...fields } = input;
  const metadata = Object.fromEntries(Object.entries({ rank, team, cveId, severity, platform, credentialId }).filter(([, v]) => v));
  const row = {
    type: fields.type,
    title: fields.title,
    issuer: fields.issuer ?? null,
    description: fields.description ?? null,
    achievedOn: fields.achievedOn ?? null,
    expiresOn: fields.expiresOn ?? null,
    evidenceUrl: fields.evidenceUrl ?? null,
    featured: fields.featured,
    metadata,
  };
  if (id) {
    const [current] = await db.select().from(achievements).where(and(eq(achievements.id, id), eq(achievements.userId, user.id))).limit(1);
    if (!current) return fail("That achievement could not be found.");
    // A verified claim that is materially edited is no longer the claim that was verified.
    const claimChanged = current.title !== row.title || current.issuer !== row.issuer || current.evidenceUrl !== row.evidenceUrl || current.type !== row.type;
    await db
      .update(achievements)
      .set({
        ...row,
        ...(claimChanged && current.verificationStatus !== "unverified"
          ? { verificationStatus: "unverified" as const, verifiedAt: null, verifiedById: null, verificationNote: null, verificationRequestedAt: null }
          : {}),
      })
      .where(eq(achievements.id, id));
    return ok(claimChanged && current.verificationStatus === "verified" ? "Saved. Because the claim changed, it needs to be verified again." : "Achievement saved.");
  }
  await db.insert(achievements).values({ userId: user.id, ...row });
  return ok("Achievement added. It is shown as self-reported until a moderator verifies it.");
});

export const requestAchievementVerificationAction = callAction({ schema: z.object({ id: zId }), rateLimit: "submission" }, async ({ id }, { user }) => {
  const [current] = await db.select().from(achievements).where(and(eq(achievements.id, id), eq(achievements.userId, user.id))).limit(1);
  if (!current) return fail("That achievement could not be found.");
  if (current.verificationStatus === "verified") return ok("This achievement is already verified.");
  if (current.verificationStatus === "pending") return ok("This achievement is already in the review queue.");
  if (!current.evidenceUrl) return fail("Add a public evidence link first — moderators verify against it.");
  await db.update(achievements).set({ verificationStatus: "pending", verificationRequestedAt: new Date(), verificationNote: null }).where(eq(achievements.id, id));
  return ok("Submitted for review. You will be notified of the outcome.");
});

// ── Settings: privacy & notifications ────────────────────────────────────────

const privacySchema = z.object({
  visibility: zOneOf(values(PROFILE_VISIBILITIES)),
  indexable: zBool,
  recruiterDiscoverable: zBool,
  messagePolicy: zOneOf(values(MESSAGE_POLICIES)),
  showEmail: zBool,
  openToWork: zBool,
  openToWorkVisibility: zOneOf(values(OPEN_TO_WORK_VISIBILITIES)),
});

export const updatePrivacyAction = formAction({ schema: privacySchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  // A profile that is not public can never be indexed, whatever the checkbox says.
  await db
    .update(profiles)
    .set({ ...input, indexable: input.visibility === "public" && input.indexable })
    .where(eq(profiles.userId, user.id));
  await audit("settings.privacy_updated", { actorId: user.id, targetType: "user", targetId: user.id, metadata: { visibility: input.visibility } });
  revalidatePath(`/u/${user.username}`);
  return ok("Privacy settings saved.");
});

export const updateNotificationPrefsAction = formAction({ schema: z.record(z.string(), z.unknown()), rateLimit: "profileWrite" }, async (input, { user }) => {
  const prefs: NotificationPrefs = {};
  for (const type of NOTIFICATION_TYPES) {
    // Account and moderation notices are always delivered in-app.
    prefs[type.value] = { inApp: type.value === "system" ? true : input[`inApp:${type.value}`] === "on", email: input[`email:${type.value}`] === "on" };
  }
  await db.update(profiles).set({ notificationPrefs: prefs }).where(eq(profiles.userId, user.id));
  return ok("Notification preferences saved.");
});

// ── Settings: security ───────────────────────────────────────────────────────

const passwordSchema = z
  .object({ currentPassword: z.string().max(1024).optional(), password: zPassword, confirm: zPassword })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords do not match." });

export const changePasswordAction = formAction({ schema: passwordSchema, rateLimit: "passwordReset" }, async (input, { user, sessionId }) => {
  const [account] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!account) return fail("This account is no longer available.");
  if (account.passwordHash) {
    if (!input.currentPassword || !(await verifyPassword(account.passwordHash, input.currentPassword))) {
      await audit("auth.password_change_failed", { actorId: user.id, targetType: "user", targetId: user.id });
      return fail("Your current password is incorrect.", { currentPassword: "Incorrect password." });
    }
  }
  const policy = checkPasswordPolicy(input.password, { email: user.email, name: user.name });
  if (!policy.ok) return fail("Please choose a stronger password.", { password: policy.message });
  if (await isPasswordBreached(input.password)) {
    return fail("Please choose a different password.", { password: "This password has appeared in a known data breach. Choose one you have not used elsewhere." });
  }
  await db.update(users).set({ passwordHash: await hashPassword(input.password), failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await revokeUserSessions(user.id, sessionId);
  await audit("auth.password_changed", { actorId: user.id, targetType: "user", targetId: user.id });
  await sendMail(emails.passwordChanged(user.email));
  return ok("Password changed. Your other sessions have been signed out.");
});

export const revokeSessionAction = callAction({ schema: z.object({ id: z.string().regex(/^[a-f0-9]{16}$/) }) }, async ({ id }, { user, sessionId }) => {
  // Sessions are addressed by a short prefix of their hash so the full identifier never reaches the browser.
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user.id));
  const target = rows.find((s) => s.id.startsWith(id));
  if (!target) return fail("That session has already ended.");
  if (target.id === sessionId) return fail("Use Sign out to end your current session.");
  await db.delete(sessions).where(and(eq(sessions.id, target.id), eq(sessions.userId, user.id)));
  await audit("auth.session_revoked", { actorId: user.id, targetType: "user", targetId: user.id });
  return ok("Session signed out.");
});

export const revokeOtherSessionsAction = callAction({ schema: z.object({}) }, async (_input, { user, sessionId }) => {
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, sessionId)));
  await audit("auth.sessions_revoked", { actorId: user.id, targetType: "user", targetId: user.id });
  return ok("All other sessions have been signed out.");
});

const deleteSchema = z.object({ confirm: z.string().trim().toLowerCase(), password: z.string().max(1024).optional() });

/**
 * Closes the account. The row is kept (so reports, audit history and conversations keep their
 * integrity) but every piece of personal data is removed and the member's content is hidden.
 */
export const deleteAccountAction = formAction({ schema: deleteSchema, rateLimit: "passwordReset" }, async (input, { user }) => {
  if (input.confirm !== user.username) return fail("Type your handle exactly to confirm.", { confirm: "This does not match your handle." });
  const [account] = await db.select({ passwordHash: users.passwordHash, role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!account) return fail("This account is no longer available.");
  if (account.role === "super_admin") return fail("A super admin account cannot be deleted from here. Transfer the role first.");
  if (account.passwordHash && (!input.password || !(await verifyPassword(account.passwordHash, input.password)))) {
    return fail("Your password is incorrect.", { password: "Incorrect password." });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: "deleted",
        statusReason: "Closed by the member",
        email: `deleted-${user.id}@deleted.invalid`,
        name: "Deleted member",
        username: `deleted-${user.id}`.slice(0, 30),
        passwordHash: null,
        emailVerifiedAt: null,
      })
      .where(eq(users.id, user.id));
    await tx.delete(profiles).where(eq(profiles.userId, user.id));
    await tx.insert(profiles).values({ userId: user.id, visibility: "private", indexable: false });
    await tx.delete(experiences).where(eq(experiences.userId, user.id));
    await tx.delete(educations).where(eq(educations.userId, user.id));
    await tx.delete(projects).where(eq(projects.userId, user.id));
    await tx.delete(achievements).where(eq(achievements.userId, user.id));
    await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  await audit("account.deleted", { actorId: user.id, targetType: "user", targetId: user.id });
  await destroyCurrentSession();
  redirect("/?closed=1");
});
