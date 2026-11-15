import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { companyMembers, connections, jobApplications, jobs } from "@/db/schema";
import { can } from "@/lib/auth/permissions";
import type { MessagePolicy, Role } from "@/lib/constants";
import { pairKey } from "@/server/queries/people";

export type MessagingGate = { allowed: true; viaApplication: boolean } | { allowed: false; reason: string };

/**
 * Decides whether one member may start a conversation with another.
 *
 * Direct messages work the way professional networks are expected to: the recipient must have
 * accepted a connection request first. Two narrow exceptions exist — platform staff, and a
 * hiring team writing to someone who applied to one of its roles (the candidate made first
 * contact by applying). Replying inside an existing conversation is not gated by this.
 */
export async function messagingGate(
  sender: { id: string; role: Role },
  recipient: { id: string; name: string; messagePolicy: MessagePolicy | null },
): Promise<MessagingGate> {
  if (can(sender.role, "moderate:content")) return { allowed: true, viaApplication: false };
  if (recipient.messagePolicy === "none") return { allowed: false, reason: `${recipient.name} is not accepting new messages.` };

  const [connection] = await db
    .select({ status: connections.status })
    .from(connections)
    .where(eq(connections.pairKey, pairKey(sender.id, recipient.id)))
    .limit(1);
  if (connection?.status === "accepted") return { allowed: true, viaApplication: false };

  const [application] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobs.id, jobApplications.jobId))
    .innerJoin(companyMembers, and(eq(companyMembers.companyId, jobs.companyId), eq(companyMembers.userId, sender.id)))
    .where(and(eq(jobApplications.userId, recipient.id), ne(jobApplications.status, "withdrawn")))
    .limit(1);
  if (application) return { allowed: true, viaApplication: true };

  return {
    allowed: false,
    reason:
      connection?.status === "pending"
        ? `Your connection request to ${recipient.name} is still pending. You can message them once it is accepted.`
        : `You can message ${recipient.name} once they accept your connection request.`,
  };
}
