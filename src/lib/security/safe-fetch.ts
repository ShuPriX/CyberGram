import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import { env } from "@/lib/env";

/**
 * Outbound HTTP for administrator-configured job feeds, hardened against SSRF:
 * https only, no credentials in the URL, every hop's hostname must resolve exclusively to
 * public addresses, redirects are followed manually and re-validated, and the response is
 * size- and time-bounded.
 *
 * Note: resolution is checked before the request, so a hostile DNS server could still race the
 * check (DNS rebinding). Feeds are added only by administrators, which bounds that risk; deploy
 * with egress filtering if stricter guarantees are required.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const value = ipv4ToInt(address);
    return !PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return false;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]!);
    if (/^f[cd]/.test(lower)) return false; // fc00::/7 unique local
    if (/^fe[89ab]/.test(lower)) return false; // fe80::/10 link-local
    if (lower.startsWith("ff")) return false; // multicast
    if (lower.startsWith("2001:db8")) return false; // documentation
    return true;
  }
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("The feed URL is not valid.");
  }
  const isLocalDev = env.ALLOW_LOCAL_FEEDS && !env.isProd && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (isLocalDev) return url;

  if (url.protocol !== "https:") throw new UnsafeUrlError("Feeds must be served over https.");
  if (url.username || url.password) throw new UnsafeUrlError("Feed URLs must not contain credentials.");
  if (url.port && url.port !== "443") throw new UnsafeUrlError("Feeds must use the standard https port.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError(`Could not resolve ${host}.`);
  if (!addresses.every((a) => isPublicAddress(a.address))) {
    throw new UnsafeUrlError("The feed resolves to a private or reserved network address.");
  }
  return url;
}

export type SafeFetchOptions = { maxBytes?: number; timeoutMs?: number; accept?: string };

export async function safeFetchText(raw: string, options: SafeFetchOptions = {}): Promise<string> {
  const { maxBytes = 15 * 1024 * 1024, timeoutMs = 20_000, accept = "application/json" } = options;
  const signal = AbortSignal.timeout(timeoutMs);

  let current = raw;
  for (let hop = 0; hop < 4; hop++) {
    const url = await assertSafeUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      cache: "no-store",
      headers: { Accept: accept, "User-Agent": `CyberGramJobSync/1.0 (+${env.APP_URL})` },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error(`Redirect without a location from ${url.host}`);
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`${url.host} responded with HTTP ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error("The feed response is larger than the allowed size.");
    if (!res.body) return "";

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new Error("The feed response is larger than the allowed size.");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  throw new Error("The feed redirected too many times.");
}

export async function safeFetchJson<T = unknown>(raw: string, options: SafeFetchOptions = {}): Promise<T> {
  const text = await safeFetchText(raw, options);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The feed did not return valid JSON.");
  }
}
