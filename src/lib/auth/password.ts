import "server-only";
import { createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { env } from "@/lib/env";

/**
 * Argon2id with parameters above the OWASP baseline (m=19 MiB, t=2):
 * 64 MiB memory, 3 iterations, 1 lane. Parameters are embedded in each hash, so they can be
 * raised later without invalidating existing credentials.
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;
/**
 * Runs a full verification against a throwaway hash. Called when the account does not exist
 * so that "unknown email" and "wrong password" take the same time.
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword("cybergram-timing-equalisation-placeholder");
  await verifyPassword(await dummyHash, password);
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
  "1234567890", "12345678910", "0123456789", "9876543210", "qwertyuiop", "qwerty12345", "qwerty123456",
  "1q2w3e4r5t", "1qaz2wsx3edc", "zaq12wsxcde3", "iloveyou12", "iloveyou123", "letmein123", "welcome123",
  "welcome1234", "admin12345", "administrator", "changeme123", "football123", "baseball123", "superman123",
  "trustno1234", "sunshine123", "princess123", "dragon12345", "monkey12345", "abcd123456", "abc1234567",
  "a1b2c3d4e5", "india12345", "cybersecurity", "hackerman123", "kalilinux123", "toor1234567",
]);

export type PasswordPolicyResult = { ok: true } | { ok: false; message: string };

/** Local policy checks. Length over composition rules, per NIST SP 800-63B. */
export function checkPasswordPolicy(password: string, context: { email?: string; name?: string } = {}): PasswordPolicyResult {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  const lower = password.toLowerCase();
  if (new Set(lower).size < 5) {
    return { ok: false, message: "That password is too repetitive. Try a longer passphrase." };
  }
  if (COMMON_PASSWORDS.has(lower)) {
    return { ok: false, message: "That password is too common. Try a longer passphrase." };
  }
  const localPart = context.email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, message: "Your password should not contain your email address." };
  }
  const nameParts = (context.name ?? "").toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  if (nameParts.some((p) => lower.includes(p)) && password.length < 16) {
    return { ok: false, message: "Your password should not be based on your name." };
  }
  return { ok: true };
}

/**
 * Checks the password against the Have I Been Pwned corpus using k-anonymity: only the first
 * five characters of its SHA-1 digest leave the server. Fails open on network errors so an
 * outage of a third party can never block sign-up.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  if (!env.HIBP_CHECK) return false;
  const digest = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "CyberGram-password-check" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix) return Number(count) > 0;
    }
    return false;
  } catch {
    return false;
  }
}
