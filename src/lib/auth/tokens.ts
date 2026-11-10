import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 256 bits of entropy, URL-safe. Used for session, verification and reset tokens. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Tokens are high-entropy random values, so a fast unsalted hash is the right choice here:
 * the database only ever stores the digest and a leak does not reveal usable tokens.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hmacSign(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
