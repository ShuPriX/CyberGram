import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Authenticated encryption (AES-256-GCM) for the few third-party tokens the app must store.
 * The key is derived from APP_SECRET with a purpose label, so it is never the secret itself.
 */
const key = () => Buffer.from(hkdfSync("sha256", env.APP_SECRET, "cybergram", "secret-box:v1", 32));

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/** Returns null when the value was sealed with a different key or has been altered. */
export function openSecret(sealed: string): string | null {
  try {
    const raw = Buffer.from(sealed, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex");
