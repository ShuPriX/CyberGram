import "server-only";
import { env } from "@/lib/env";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };
type Hit = { count: number; resetAt: number };

interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<Hit>;
}

/** Fixed-window counters held in process memory. Correct for a single instance. */
export class MemoryStore implements RateLimitStore {
  private readonly counters = new Map<string, Hit>();
  private lastSweep = Date.now();

  async hit(key: string, windowMs: number): Promise<Hit> {
    const now = Date.now();
    this.sweep(now);
    const existing = this.counters.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.counters.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, hit] of this.counters) if (hit.resetAt <= now) this.counters.delete(key);
  }
}

// Atomic increment-with-expiry so a crash between INCR and PEXPIRE can never leave a
// counter without a TTL (which would block the caller forever).
const REDIS_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
`;

type RedisLike = { eval: (script: string, numKeys: number, ...args: (string | number)[]) => Promise<unknown> };

class RedisStore implements RateLimitStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly fallback: RateLimitStore,
  ) {}

  async hit(key: string, windowMs: number): Promise<Hit> {
    try {
      const [count, ttl] = (await this.redis.eval(REDIS_SCRIPT, 1, `rl:${key}`, windowMs)) as [number, number];
      return { count, resetAt: Date.now() + ttl };
    } catch (err) {
      // Degrade to per-instance limiting rather than failing open or taking the site down.
      console.error("[rate-limit] redis unavailable, using in-memory limiter", err);
      return this.fallback.hit(key, windowMs);
    }
  }
}

const globalStore = globalThis as unknown as { __cybergramRateLimit?: Promise<RateLimitStore> };

async function createStore(): Promise<RateLimitStore> {
  const memory = new MemoryStore();
  if (!env.REDIS_URL) return memory;
  const { Redis } = await import("ioredis");
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  redis.on("error", () => {
    // Errors surface per call in RedisStore.hit; this listener prevents unhandled-error crashes.
  });
  return new RedisStore(redis as unknown as RedisLike, memory);
}

function store(): Promise<RateLimitStore> {
  return (globalStore.__cybergramRateLimit ??= createStore());
}

/**
 * Policies. `limit` requests per `windowSec` for each (bucket, identifier) pair.
 * Identifiers are a user id for authenticated actions and the client address otherwise.
 */
export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSec: 15 * 60 },
  loginAccount: { limit: 8, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  passwordReset: { limit: 5, windowSec: 60 * 60 },
  emailVerification: { limit: 5, windowSec: 60 * 60 },
  oauth: { limit: 30, windowSec: 15 * 60 },
  contact: { limit: 5, windowSec: 60 * 60 },
  post: { limit: 20, windowSec: 60 * 60 },
  comment: { limit: 60, windowSec: 60 * 60 },
  reaction: { limit: 300, windowSec: 60 * 60 },
  message: { limit: 120, windowSec: 60 * 60 },
  newConversation: { limit: 20, windowSec: 24 * 60 * 60 },
  connection: { limit: 40, windowSec: 24 * 60 * 60 },
  follow: { limit: 200, windowSec: 60 * 60 },
  upload: { limit: 40, windowSec: 60 * 60 },
  report: { limit: 20, windowSec: 60 * 60 },
  application: { limit: 40, windowSec: 24 * 60 * 60 },
  jobPost: { limit: 30, windowSec: 24 * 60 * 60 },
  submission: { limit: 10, windowSec: 24 * 60 * 60 },
  profileWrite: { limit: 120, windowSec: 60 * 60 },
  search: { limit: 120, windowSec: 60 },
  generic: { limit: 240, windowSec: 60 },
} as const;
export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export async function rateLimit(policy: RateLimitPolicy, identifier: string): Promise<RateLimitResult> {
  const { limit, windowSec } = RATE_LIMITS[policy];
  const hit = await (await store()).hit(`${policy}:${identifier}`, windowSec * 1000);
  return {
    ok: hit.count <= limit,
    remaining: Math.max(0, limit - hit.count),
    retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)),
  };
}

export function retryMessage(result: RateLimitResult): string {
  const minutes = Math.ceil(result.retryAfterSec / 60);
  return result.retryAfterSec < 90
    ? "Too many attempts. Please wait a minute and try again."
    : `Too many attempts. Please try again in about ${minutes} minutes.`;
}
