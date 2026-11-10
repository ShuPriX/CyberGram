import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { can, type Capability } from "@/lib/auth/permissions";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { rateLimit, retryMessage, type RateLimitPolicy } from "@/lib/security/rate-limit";
import { getRequestMeta } from "@/lib/security/request";
import { fieldErrorsOf, formToObject } from "@/lib/validation";

/**
 * Uniform result for every mutation. Forms consume it through `useActionState`; imperative
 * callers (buttons, optimistic UI) check `ok`.
 */
export type ActionState<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;

/** Throw from a handler to return a specific, user-safe message. */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export const fail = (error: string, fieldErrors?: Record<string, string>): ActionState => ({ ok: false, error, fieldErrors });
export const ok = <T>(message?: string, data?: T): ActionState<T> => ({ ok: true, message, data });

type BaseOptions<S extends z.ZodType> = {
  schema: S;
  /** Rate-limit policy, keyed by member id (or client address for public actions). */
  rateLimit?: RateLimitPolicy;
};
type AuthedOptions<S extends z.ZodType> = BaseOptions<S> & {
  /** Platform capability required in addition to being signed in. */
  capability?: Capability;
};

type AuthedHandler<S extends z.ZodType, T> = (
  input: z.output<S>,
  ctx: { user: SessionUser; sessionId: string },
) => Promise<ActionState<T> | void>;
type PublicHandler<S extends z.ZodType, T> = (
  input: z.output<S>,
  ctx: { user: SessionUser | null; ip: string },
) => Promise<ActionState<T> | void>;

/** PostgreSQL unique-violation, regardless of which driver (or wrapper) raised it. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

function handleError(err: unknown): ActionState {
  // Framework control flow (redirect / notFound) must propagate untouched.
  unstable_rethrow(err);
  if (err instanceof ActionError) return fail(err.message, err.fieldErrors);
  console.error("[action] unhandled error", err);
  return fail("Something went wrong on our side. Please try again.");
}

async function runAuthed<S extends z.ZodType, T>(
  options: AuthedOptions<S>,
  raw: unknown,
  handler: AuthedHandler<S, T>,
): Promise<ActionState<T>> {
  try {
    // 1. Authentication — every non-public action re-validates the session server-side.
    const session = await getSession();
    if (!session) return fail("Your session has expired. Please sign in again.") as ActionState<T>;

    // 2. Authorisation.
    if (options.capability && !can(session.user.role, options.capability)) {
      return fail("You do not have permission to do that.") as ActionState<T>;
    }

    // 3. Abuse control.
    if (options.rateLimit) {
      const limit = await rateLimit(options.rateLimit, session.user.id);
      if (!limit.ok) return fail(retryMessage(limit)) as ActionState<T>;
    }

    // 4. Input validation and normalisation.
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error)) as ActionState<T>;
    }

    const result = await handler(parsed.data, { user: session.user, sessionId: session.sessionId });
    return result ?? ({ ok: true } as ActionState<T>);
  } catch (err) {
    return handleError(err) as ActionState<T>;
  }
}

async function runPublic<S extends z.ZodType, T>(
  options: BaseOptions<S>,
  raw: unknown,
  handler: PublicHandler<S, T>,
): Promise<ActionState<T>> {
  try {
    const [session, meta] = await Promise.all([getSession(), getRequestMeta()]);
    if (options.rateLimit) {
      const limit = await rateLimit(options.rateLimit, session?.user.id ?? meta.ip);
      if (!limit.ok) return fail(retryMessage(limit)) as ActionState<T>;
    }
    const parsed = options.schema.safeParse(raw);
    if (!parsed.success) {
      return fail("Please check the highlighted fields.", fieldErrorsOf(parsed.error)) as ActionState<T>;
    }
    const result = await handler(parsed.data, { user: session?.user ?? null, ip: meta.ip });
    return result ?? ({ ok: true } as ActionState<T>);
  } catch (err) {
    return handleError(err) as ActionState<T>;
  }
}

/** A signed-in action bound to a <form>. Use with `useActionState`. */
export function formAction<S extends z.ZodType, T = unknown>(options: AuthedOptions<S>, handler: AuthedHandler<S, T>) {
  return async (_prev: ActionState<T>, formData: FormData): Promise<ActionState<T>> =>
    runAuthed(options, formToObject(formData), handler);
}

/** A signed-in action called directly with a typed argument (buttons, optimistic UI). */
export function callAction<S extends z.ZodType, T = unknown>(options: AuthedOptions<S>, handler: AuthedHandler<S, T>) {
  return async (input: z.input<S>): Promise<ActionState<T>> => runAuthed(options, input, handler);
}

/** A form action that does not require a session (sign-in, registration, contact…). */
export function publicFormAction<S extends z.ZodType, T = unknown>(options: BaseOptions<S>, handler: PublicHandler<S, T>) {
  return async (_prev: ActionState<T>, formData: FormData): Promise<ActionState<T>> =>
    runPublic(options, formToObject(formData), handler);
}
