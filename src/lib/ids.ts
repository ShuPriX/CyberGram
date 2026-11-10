import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Collision-resistant, URL-safe identifier for database rows.
 * Not for secrets — session and verification tokens use `generateToken()`.
 */
export function newId(length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** Short suffix used to make human-readable slugs unique. */
export function shortId(length = 8): string {
  return newId(length);
}
