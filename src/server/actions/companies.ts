"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { companies, companyMembers, users } from "@/db/schema";
import { COMPANY_SIZES, COMPANY_TYPE_VALUES, RESERVED_USERNAMES } from "@/lib/constants";
import { shortId } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { slugify } from "@/lib/utils";
import { zCountry, zCsv, zId, zInline, zOneOf, zOptionalId, zOptionalInline, zOptionalOneOf, zOptionalText, zOptionalUrl, zStringList, zText, zUsername } from "@/lib/validation";
import { callAction, fail, formAction, isUniqueViolation, ok } from "@/server/action-utils";
import { getActiveCategories } from "@/server/queries/taxonomy";
import { ownedFileId, requireCompanyAccess } from "@/server/services/access";
import { notify } from "@/server/services/notify";

// Organisation names may not imitate verification or the platform itself.
const zCompanyName = zInline(100, 2)
  .refine((v) => !/[✓✔☑✅<>{}[\]\\|^~`]/u.test(v), "Names cannot contain symbols or badges.")
  .refine((v) => !/\b(verified|official)\b/i.test(v), "Names cannot claim to be verified or official.")
  .refine((v) => !/^cyber\s?gram\b/i.test(v), "That name is reserved.");

const companyShape = {
  name: zCompanyName,
  tagline: zOptionalInline(160),
  description: zOptionalText(6000),
  type: zOneOf(COMPANY_TYPE_VALUES),
  size: zOptionalOneOf(COMPANY_SIZES),
  hqLocation: zOptionalInline(120),
  hqCountry: zCountry,
  locations: zCsv(12, 80),
  website: zOptionalUrl,
  linkedinUrl: zOptionalUrl,
  twitterUrl: zOptionalUrl,
  githubUrl: zOptionalUrl,
  specializations: zStringList(8, 60),
};

type CompanyInput = z.output<z.ZodObject<typeof companyShape>>;

async function companyColumns(input: CompanyInput) {
  const known = new Set((await getActiveCategories()).map((c) => c.slug));
  return {
    name: input.name,
    tagline: input.tagline ?? null,
    description: input.description ?? null,
    type: input.type,
    size: input.size ?? null,
    hqLocation: input.hqLocation ?? null,
    hqCountry: input.hqCountry ?? null,
    locations: input.locations,
    website: input.website ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
    twitterUrl: input.twitterUrl ?? null,
    githubUrl: input.githubUrl ?? null,
    specializations: input.specializations.filter((s) => known.has(s)),
  };
}

export const createCompanyAction = formAction({ schema: z.object(companyShape), rateLimit: "submission" }, async (input, { user }) => {
  if (!user.emailVerified) return fail("Verify your email address before creating an organisation page.");
  const [owned] = await db.select({ value: count() }).from(companyMembers).where(and(eq(companyMembers.userId, user.id), eq(companyMembers.role, "owner")));
  if ((owned?.value ?? 0) >= 3) return fail("You already own three organisation pages. Contact support if you need more.");

  const base = slugify(input.name, 50) || "company";
  // A page may not take a member's handle or a reserved word: both share the @mention namespace.
  const [clash] = await db.select({ id: users.id }).from(users).where(eq(users.username, base)).limit(1);
  // "new", "jobs" and "candidates" are route segments next to /companies/<slug> and /recruiter/<slug>.
  const reserved = RESERVED_USERNAMES.has(base) || ["new", "jobs", "candidates", "edit"].includes(base);
  let slug = reserved || clash || base.length < 3 ? `${base}-${shortId(4)}` : base;
  const columns = await companyColumns(input);

  let companyId: string | null = null;
  for (let attempt = 0; attempt < 3 && !companyId; attempt++) {
    try {
      const [created] = await db.insert(companies).values({ ...columns, slug, createdById: user.id }).returning({ id: companies.id });
      companyId = created!.id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      slug = `${base}-${shortId(4)}`;
    }
  }
  if (!companyId) return fail("We could not create that page. Please try a slightly different name.");

  await db.insert(companyMembers).values({ companyId, userId: user.id, role: "owner" });
  // The platform role only labels the account; permissions always come from company_members.
  if (user.role === "user") await db.update(users).set({ role: "recruiter" }).where(eq(users.id, user.id));
  await audit("company.created", { actorId: user.id, targetType: "company", targetId: companyId, metadata: { slug } });
  redirect(`/recruiter/${slug}?created=1`);
});

const updateSchema = z.object({ ...companyShape, companyId: zId, logoFileId: zOptionalId, coverFileId: zOptionalId });

export const updateCompanyAction = formAction({ schema: updateSchema, rateLimit: "profileWrite" }, async (input, { user }) => {
  const { company } = await requireCompanyAccess(user.id, input.companyId, "manage");
  const [logo, cover, columns] = await Promise.all([
    ownedFileId(user.id, input.logoFileId === company.logoFileId ? null : input.logoFileId, "logo"),
    ownedFileId(user.id, input.coverFileId === company.coverFileId ? null : input.coverFileId, "cover"),
    companyColumns(input),
  ]);
  // Renaming a verified organisation would let the badge travel to a different identity.
  const renamed = columns.name !== company.name;
  await db
    .update(companies)
    .set({
      ...columns,
      logoFileId: input.logoFileId ? (logo ?? company.logoFileId) : null,
      coverFileId: input.coverFileId ? (cover ?? company.coverFileId) : null,
      ...(renamed && company.verificationStatus === "verified"
        ? { verificationStatus: "pending" as const, verifiedAt: null, verifiedById: null, verificationRequestedAt: new Date(), verificationNote: "Name changed after verification" }
        : {}),
    })
    .where(eq(companies.id, company.id));
  await audit("company.updated", { actorId: user.id, targetType: "company", targetId: company.id, metadata: { renamed } });
  revalidatePath(`/companies/${company.slug}`);
  return ok(renamed && company.verificationStatus === "verified" ? "Saved. Because the name changed, verification will be reviewed again." : "Organisation page saved.");
});

export const requestCompanyVerificationAction = formAction(
  { schema: z.object({ companyId: zId, evidence: zText(2000, 30) }), rateLimit: "submission" },
  async (input, { user }) => {
    const { company } = await requireCompanyAccess(user.id, input.companyId, "manage");
    if (company.verificationStatus === "verified") return ok("This organisation is already verified.");
    if (company.verificationStatus === "pending") return ok("A verification request is already being reviewed.");
    if (!company.website) return fail("Add the organisation's website to its page first — verification is checked against it.");
    await db
      .update(companies)
      .set({ verificationStatus: "pending", verificationEvidence: input.evidence, verificationRequestedAt: new Date(), verificationNote: null })
      .where(eq(companies.id, company.id));
    await audit("company.verification_requested", { actorId: user.id, targetType: "company", targetId: company.id });
    return ok("Verification requested. An administrator will review the evidence.");
  },
);

export const addCompanyMemberAction = formAction(
  { schema: z.object({ companyId: zId, username: zUsername, role: zOneOf(["admin", "recruiter"] as const), title: zOptionalInline(80) }), rateLimit: "profileWrite" },
  async (input, { user }) => {
    const { company } = await requireCompanyAccess(user.id, input.companyId, "manage");
    const [member] = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.username, input.username), eq(users.status, "active"))).limit(1);
    if (!member) return fail("No member has that handle.", { username: "No member has that handle." });
    const [total] = await db.select({ value: count() }).from(companyMembers).where(eq(companyMembers.companyId, company.id));
    if ((total?.value ?? 0) >= 25) return fail("An organisation can have up to 25 team members.");
    const added = await db.insert(companyMembers).values({ companyId: company.id, userId: member.id, role: input.role, title: input.title ?? null }).onConflictDoNothing().returning({ userId: companyMembers.userId });
    if (added.length === 0) return fail("That member is already on the team.");
    if (member.role === "user") await db.update(users).set({ role: "recruiter" }).where(eq(users.id, member.id));
    await audit("company.member_added", { actorId: user.id, targetType: "company", targetId: company.id, metadata: { userId: member.id, role: input.role } });
    await notify({
      userId: member.id,
      actorId: user.id,
      type: "system",
      entityType: "company",
      entityId: company.id,
      data: { title: `You were added to ${company.name}`, preview: "You can now post jobs and review applicants for this organisation.", href: `/recruiter/${company.slug}` },
    });
    return ok("Team member added.");
  },
);

export const removeCompanyMemberAction = callAction({ schema: z.object({ companyId: zId, userId: zId }) }, async ({ companyId, userId }, { user }) => {
  const leaving = userId === user.id;
  const { company } = await requireCompanyAccess(user.id, companyId, leaving ? "member" : "manage");
  const [target] = await db.select({ role: companyMembers.role }).from(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId))).limit(1);
  if (!target) return fail("That person is not on the team.");
  if (target.role === "owner") {
    const [owners] = await db.select({ value: count() }).from(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.role, "owner"), ne(companyMembers.userId, userId)));
    if ((owners?.value ?? 0) === 0) return fail("An organisation must keep at least one owner.");
  }
  await db.delete(companyMembers).where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)));
  await audit("company.member_removed", { actorId: user.id, targetType: "company", targetId: company.id, metadata: { userId } });
  return ok(leaving ? "You left the organisation." : "Team member removed.");
});
