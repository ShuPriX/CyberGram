import "server-only";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";

export type MailMessage = { to: string; subject: string; text: string; html: string };
export type StoredMail = MailMessage & { id: string; createdAt: string };

const OUTBOX_DIR = path.resolve(process.cwd(), ".data/outbox");

/** True when mail is captured locally instead of being delivered (development without SMTP). */
export const usesDevOutbox = !env.SMTP_URL && !env.isProd;

type Transport = { sendMail(message: MailMessage & { from: string }): Promise<unknown> };
let transport: Promise<Transport> | undefined;

function getTransport(): Promise<Transport> {
  transport ??= import("nodemailer").then((nodemailer) => nodemailer.createTransport(env.SMTP_URL!) as Transport);
  return transport;
}

/**
 * Sends a transactional email. Never throws: callers must not leak delivery failures to the
 * requester (that would reveal whether an address has an account).
 */
export async function sendMail(message: MailMessage): Promise<boolean> {
  try {
    if (env.SMTP_URL) {
      await (await getTransport()).sendMail({ from: env.EMAIL_FROM, ...message });
      return true;
    }
    if (env.isProd) {
      console.error(`[mail] SMTP_URL is not configured; dropped "${message.subject}"`);
      return false;
    }
    await mkdir(OUTBOX_DIR, { recursive: true });
    const stored: StoredMail = { id: newId(12), createdAt: new Date().toISOString(), ...message };
    await writeFile(path.join(OUTBOX_DIR, `${Date.now()}-${stored.id}.json`), JSON.stringify(stored, null, 2), "utf8");
    console.info(`[mail] captured "${message.subject}" for ${message.to} — view at ${env.APP_URL}/dev/outbox`);
    return true;
  } catch (err) {
    console.error("[mail] delivery failed", err);
    return false;
  }
}

/** Development only: the most recent captured emails, newest first. */
export async function readDevOutbox(limit = 50): Promise<StoredMail[]> {
  if (!usesDevOutbox) return [];
  try {
    const names = (await readdir(OUTBOX_DIR)).filter((n) => n.endsWith(".json")).sort().reverse().slice(0, limit);
    const mails = await Promise.all(
      names.map(async (name) => JSON.parse(await readFile(path.join(OUTBOX_DIR, name), "utf8")) as StoredMail),
    );
    return mails;
  } catch {
    return [];
  }
}
