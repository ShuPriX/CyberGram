import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { outboundAccounts } from "@/db/schema";
import { env } from "@/lib/env";
import { fingerprint, openSecret, sealSecret } from "@/lib/security/secret-box";

/**
 * Publishing to Instagram through Meta's official "Instagram API with Instagram login".
 * The account must be a Professional (Business or Creator) account; posting as a person's
 * personal account is not possible through any official route and is not attempted here.
 *
 * Flow per post: create a media container from a public image URL → wait until it is ready →
 * publish it. Nothing is scraped, and no password is ever handled: access is a token the
 * account owner generated for their own app.
 */

const GRAPH = "https://graph.instagram.com/v23.0";
const RENEW_WITHIN_MS = 15 * 24 * 60 * 60 * 1000;

export class InstagramError extends Error {
  /** Meta's error code; 190 means the token is no longer valid. */
  constructor(message: string, readonly code?: number) {
    super(message);
    this.name = "InstagramError";
  }
}

async function graph<T>(path: string, init: { method?: "GET" | "POST"; params: Record<string, string> }): Promise<T> {
  const method = init.method ?? "GET";
  const body = new URLSearchParams(init.params);
  const url = method === "GET" ? `${GRAPH}${path}?${body}` : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
    headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: method === "POST" ? body : undefined,
  });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || !json || json.error) {
    throw new InstagramError(json?.error?.message ?? `Instagram responded with HTTP ${res.status}`, json?.error?.code);
  }
  return json;
}

/**
 * The token to use. A renewed token stored in the database wins over the one in the environment,
 * unless the environment token has been replaced since (a new token pasted into the dashboard).
 */
async function currentToken(): Promise<string> {
  const seed = env.INSTAGRAM_ACCESS_TOKEN!;
  const [row] = await db.select().from(outboundAccounts).where(eq(outboundAccounts.channel, "instagram")).limit(1);
  if (row && row.seedFingerprint === fingerprint(seed)) {
    const stored = openSecret(row.tokenCipher);
    if (stored) {
      if (row.expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) return (await renew(stored, seed)) ?? stored;
      return stored;
    }
  }
  // First use of this environment token: renew it straight away so the expiry is tracked and the
  // 60 day clock restarts. A token younger than 24 hours cannot be renewed yet; use it as is.
  return (await renew(seed, seed)) ?? seed;
}

async function renew(token: string, seed: string): Promise<string | null> {
  try {
    const out = await graph<{ access_token: string; expires_in: number }>("/refresh_access_token", {
      params: { grant_type: "ig_refresh_token", access_token: token },
    });
    const expiresAt = new Date(Date.now() + out.expires_in * 1000);
    const values = { tokenCipher: sealSecret(out.access_token), seedFingerprint: fingerprint(seed), expiresAt, refreshedAt: new Date() };
    await db.insert(outboundAccounts).values({ channel: "instagram", ...values }).onConflictDoUpdate({ target: outboundAccounts.channel, set: values });
    return out.access_token;
  } catch (err) {
    // Too new to renew, or a transient failure: keep using the token we have.
    console.warn("[instagram] token renewal skipped:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Publishes one image with a caption and returns Instagram's media id. */
export async function publishImage(imageUrl: string, caption: string): Promise<string> {
  if (!env.instagram) throw new InstagramError("Instagram is not connected.");
  const userId = env.INSTAGRAM_USER_ID!;
  const token = await currentToken();

  const container = await graph<{ id: string }>(`/${encodeURIComponent(userId)}/media`, {
    method: "POST",
    params: { image_url: imageUrl, caption, access_token: token },
  });

  // Images are normally ready at once; give Instagram a little time to fetch the card otherwise.
  for (let attempt = 0; attempt < 10; attempt++) {
    const state = await graph<{ status_code?: string }>(`/${encodeURIComponent(container.id)}`, {
      params: { fields: "status_code", access_token: token },
    });
    if (state.status_code === "FINISHED" || state.status_code === undefined) break;
    if (state.status_code === "ERROR" || state.status_code === "EXPIRED") throw new InstagramError(`Instagram could not process the image (${state.status_code}).`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  const published = await graph<{ id: string }>(`/${encodeURIComponent(userId)}/media_publish`, {
    method: "POST",
    params: { creation_id: container.id, access_token: token },
  });
  return published.id;
}
