"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, companies, jobs, messages, posts, reports, users } from "@/db/schema";
import { AUTO_HIDE_REPORT_THRESHOLD, REPORT_REASON_VALUES, REPORT_TARGET_TYPES } from "@/lib/constants";
import { audit } from "@/lib/security/audit";
import { zId, zOneOf, zOptionalText } from "@/lib/validation";
import { fail, formAction, ok } from "@/server/action-utils";

const schema = z.object({
  targetType: zOneOf(REPORT_TARGET_TYPES),
  targetId: zId,
  reason: zOneOf(REPORT_REASON_VALUES),
  details: zOptionalText(1000),
});

const TARGET_TABLES = { post: posts, comment: comments, user: users, job: jobs, company: companies, message: messages } as const;

/**
 * Files a report for moderators. One open report per member per item; content that collects
 * reports from several distinct members is hidden until a moderator has looked at it.
 */
export const reportAction = formAction({ schema, rateLimit: "report" }, async (input, { user }) => {
  const table = TARGET_TABLES[input.targetType];
  const [target] = await db.select({ id: table.id }).from(table).where(eq(table.id, input.targetId)).limit(1);
  if (!target) return fail("That item is no longer available.");
  if (input.targetType === "user" && input.targetId === user.id) return fail("You cannot report yourself.");

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, user.id),
        eq(reports.targetType, input.targetType),
        eq(reports.targetId, input.targetId),
        eq(reports.status, "open"),
      ),
    )
    .limit(1);
  if (existing) return ok("Thanks — you have already reported this and it is in the review queue.");

  await db.insert(reports).values({ reporterId: user.id, ...input });

  const [open] = await db
    .select({ value: count(sql`distinct ${reports.reporterId}`) })
    .from(reports)
    .where(and(eq(reports.targetType, input.targetType), eq(reports.targetId, input.targetId), eq(reports.status, "open")));
  if ((open?.value ?? 0) >= AUTO_HIDE_REPORT_THRESHOLD) {
    if (input.targetType === "post") await db.update(posts).set({ status: "hidden" }).where(and(eq(posts.id, input.targetId), eq(posts.status, "published")));
    if (input.targetType === "comment") await db.update(comments).set({ status: "hidden" }).where(and(eq(comments.id, input.targetId), eq(comments.status, "published")));
    if (input.targetType === "job") await db.update(jobs).set({ status: "pending_review", reviewNote: "Held after multiple member reports" }).where(and(eq(jobs.id, input.targetId), eq(jobs.status, "active")));
    await audit("moderation.auto_hidden", { targetType: input.targetType, targetId: input.targetId, metadata: { reports: open?.value } });
  }

  return ok("Thank you. Our moderators will review this report.");
});
