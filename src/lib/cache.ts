import "server-only";

type Entry = { value: Promise<unknown>; expires: number };
const globalStore = globalThis as unknown as { __cybergramCache?: Map<string, Entry> };
const store = (globalStore.__cybergramCache ??= new Map<string, Entry>());

/**
 * Small in-process TTL cache for frequently read, slowly changing public data (taxonomy,
 * trending topics, landing-page lists). Concurrent callers share one in-flight computation.
 * Never use it for per-member or permission-dependent data.
 */
export function memo<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;

  const value = compute().catch((err) => {
    store.delete(key); // do not cache failures
    throw err;
  });
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Drops every cached entry whose key starts with `prefix`. Call after writes that affect it. */
export function invalidate(prefix: string): void {
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
}
