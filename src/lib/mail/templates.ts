import "server-only";
import { APP_NAME } from "@/lib/constants";
import { env } from "@/lib/env";
import type { MailMessage } from "./index";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Layout = {
  to: string;
  subject: string;
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
  footnote?: string;
};

/** One layout for every transactional email: plain, legible, and identical in text and HTML. */
export function renderEmail({ to, subject, heading, lines, action, footnote }: Layout): MailMessage {
  const text = [
    heading,
    "",
    ...lines,
    ...(action ? ["", `${action.label}: ${action.url}`] : []),
    ...(footnote ? ["", footnote] : []),
    "",
    `— ${APP_NAME}`,
    env.APP_URL,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f7f8fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0e1420;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e7ec;border-radius:12px;">
    <tr><td style="padding:28px 28px 8px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#0f766e;">${escapeHtml(APP_NAME)}</td></tr>
    <tr><td style="padding:0 28px 8px;font-size:20px;font-weight:600;line-height:1.3;">${escapeHtml(heading)}</td></tr>
    <tr><td style="padding:0 28px 8px;font-size:15px;line-height:1.6;color:#374151;">
      ${lines.map((line) => `<p style="margin:12px 0;">${escapeHtml(line)}</p>`).join("\n      ")}
    </td></tr>
    ${
      action
        ? `<tr><td style="padding:8px 28px 20px;">
      <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(action.label)}</a>
      <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;">Or paste this link into your browser:<br>${escapeHtml(action.url)}</p>
    </td></tr>`
        : ""
    }
    ${footnote ? `<tr><td style="padding:0 28px 20px;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(footnote)}</td></tr>` : ""}
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #e3e7ec;font-size:12px;color:#6b7280;">
      You are receiving this because of activity on your ${escapeHtml(APP_NAME)} account.
      Manage email preferences in <a href="${escapeHtml(env.APP_URL)}/settings/notifications" style="color:#0f766e;">Settings</a>.
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject, text, html };
}

export const emails = {
  verifyEmail: (to: string, name: string, url: string) =>
    renderEmail({
      to,
      subject: `Confirm your email for ${APP_NAME}`,
      heading: `Welcome, ${name}`,
      lines: ["Confirm your email address to activate your account and start building your profile."],
      action: { label: "Confirm email", url },
      footnote: "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
    }),

  accountExists: (to: string, loginUrl: string) =>
    renderEmail({
      to,
      subject: `You already have a ${APP_NAME} account`,
      heading: "Someone tried to sign up with your email",
      lines: [
        "A registration was attempted with this address, but an account already exists.",
        "If this was you, sign in instead — or reset your password if you have forgotten it. If it was not you, no action is needed.",
      ],
      action: { label: "Sign in", url: loginUrl },
    }),

  passwordReset: (to: string, url: string) =>
    renderEmail({
      to,
      subject: `Reset your ${APP_NAME} password`,
      heading: "Reset your password",
      lines: ["We received a request to reset the password for your account."],
      action: { label: "Choose a new password", url },
      footnote: "This link expires in 30 minutes and can be used once. If you did not request it, your password is unchanged.",
    }),

  passwordChanged: (to: string) =>
    renderEmail({
      to,
      subject: `Your ${APP_NAME} password was changed`,
      heading: "Your password was changed",
      lines: [
        "The password for your account was just changed and all other sessions were signed out.",
        "If you did not do this, reset your password immediately and review the active sessions in your security settings.",
      ],
      action: { label: "Review security settings", url: `${env.APP_URL}/settings/security` },
    }),

  newSignIn: (to: string, details: { ip: string; userAgent: string | null; when: Date }) =>
    renderEmail({
      to,
      subject: `New sign-in to your ${APP_NAME} account`,
      heading: "New sign-in detected",
      lines: [
        `Time: ${details.when.toUTCString()}`,
        `IP address: ${details.ip}`,
        `Device: ${details.userAgent ?? "Unknown"}`,
        "If this was you, no action is needed. If you do not recognise it, change your password and sign out of all sessions.",
      ],
      action: { label: "Review active sessions", url: `${env.APP_URL}/settings/security` },
    }),

  notification: (to: string, subject: string, lines: string[], action: { label: string; url: string }) =>
    renderEmail({ to, subject, heading: subject, lines, action }),
};
