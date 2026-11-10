import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

export type RequestMeta = { ip: string; userAgent: string | null };

/**
 * Resolves the client address from X-Forwarded-For.
 *
 * Proxies append the address they received the connection from, so entries to the right are
 * the trustworthy ones. With `TRUSTED_PROXY_HOPS = n` we take the n-th entry from the right —
 * the address seen by the outermost proxy we control. Anything further left is client-supplied
 * and must not be used for security decisions.
 */
export function clientIpFromForwardedFor(forwardedFor: string | null, hops: number): string | null {
  if (!forwardedFor) return null;
  const parts = forwardedFor
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const index = Math.max(0, parts.length - Math.max(1, hops));
  return parts[index] ?? null;
}

/** Request metadata for rate limiting and audit logs. Returns placeholders outside a request. */
export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const ip = clientIpFromForwardedFor(h.get("x-forwarded-for"), env.TRUSTED_PROXY_HOPS) ?? h.get("x-real-ip") ?? "unknown";
    const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
    return { ip, userAgent };
  } catch {
    return { ip: "system", userAgent: null };
  }
}
