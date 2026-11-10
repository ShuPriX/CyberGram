import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, profiles, users, type NotificationData } from "@/db/schema";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/constants";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { emails } from "@/lib/mail/templates";

const EMAIL_DEFAULTS = Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t.value, t.emailDefault])) as Record<NotificationType, boolean>;

type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  data?: NotificationData;
  /** Subject line for the optional email. Falls back to `data.title`. */
  emailSubject?: string;
};

/**
 * Delivers a notification according to the recipient's preferences: in-app, by email, both or
 * neither. Never throws — a notification failure must not fail the action that caused it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;
  try {
    const [recipient] = await db
      .select({ email: users.email, status: users.status, prefs: profiles.notificationPrefs })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, input.userId))
      .limit(1);
    if (!recipient || recipient.status !== "active") return;

    const pref = recipient.prefs?.[input.type];
    const inApp = pref?.inApp ?? true;
    const email = pref?.email ?? EMAIL_DEFAULTS[input.type];

    if (inApp) {
      // Collapse repeats (e.g. like → unlike → like) into the existing unread notification.
      const [duplicate] =
        input.actorId && input.entityId
          ? await db
              .select({ id: notifications.id })
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, input.userId),
                  eq(notifications.actorId, input.actorId),
                  eq(notifications.type, input.type),
                  eq(notifications.entityId, input.entityId),
                  isNull(notifications.readAt),
                  gt(notifications.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
                ),
              )
              .limit(1)
          : [];
      if (!duplicate) {
        await db.insert(notifications).values({
          userId: input.userId,
          actorId: input.actorId ?? null,
          type: input.type,
          entityType: input.entityType,
          entityId: input.entityId,
          data: input.data ?? {},
        });
      }
    }

    const subject = input.emailSubject ?? input.data?.title;
    if (email && subject) {
      const href = input.data?.href?.startsWith("/") ? input.data.href : "/notifications";
      await sendMail(
        emails.notification(recipient.email, subject, input.data?.preview ? [input.data.preview] : [], {
          label: "View on CyberGram",
          url: `${env.APP_URL}${href}`,
        }),
      );
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
}
