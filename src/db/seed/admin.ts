import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { checkPasswordPolicy, hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/ids";

/**
 * Creates the first super administrator from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 * An existing account with that email is left untouched (its password is never reset here).
 */
export async function seedAdmin(): Promise<{ email: string; created: boolean }> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.");

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { email, created: false };

  const policy = checkPasswordPolicy(password, { email });
  if (!policy.ok) throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${policy.message}`);

  const id = newId();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email,
      name: "Platform Admin",
      username: "platform-admin",
      passwordHash: await hashPassword(password),
      role: "super_admin",
      emailVerifiedAt: now,
      onboardedAt: now,
    });
    await tx.insert(profiles).values({ userId: id, headline: "CyberGram platform team", visibility: "members", indexable: false });
  });
  return { email, created: true };
}
