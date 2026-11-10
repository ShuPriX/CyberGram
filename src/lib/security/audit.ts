import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getRequestMeta } from "./request";

export type AuditEntry = {
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  /** Never put secrets, tokens or message bodies in metadata. */
  metadata?: Record<string, unknown>;
};

/**
 * Records a security-relevant or administrative action. Failures are logged but never
 * propagate: an audit write must not turn a successful user action into an error.
 */
export async function audit(action: string, entry: AuditEntry = {}): Promise<void> {
  try {
    const meta = await getRequestMeta();
    await db.insert(auditLogs).values({
      action,
      actorId: entry.actorId ?? null,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch (err) {
    console.error(`[audit] failed to record "${action}"`, err);
  }
}
