import nodemailer, { type Transporter } from "nodemailer";

import { env } from "~/env";

/**
 * Outbound email transport.
 *
 * A real SMTP transport is created only when `SMTP_HOST` is configured. With no
 * SMTP host:
 *  - in development/test we log the message to the console (so the flow is
 *    observable, matching the magic-link dev behavior) and report success;
 *  - in production we refuse to report success — callers must record the
 *    delivery as failed rather than pretending mail went out.
 *
 * The transport is created lazily and cached for the lifetime of the process.
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

let cachedTransport: Transporter | null = null;
let transportResolved = false;

function getTransport(): Transporter | null {
  if (transportResolved) return cachedTransport;
  transportResolved = true;

  if (env.SMTP_HOST) {
    cachedTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
    });
  } else {
    cachedTransport = null;
  }
  return cachedTransport;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const transport = getTransport();

  if (!transport) {
    if (env.NODE_ENV === "production") {
      // No transport in production: do not claim a delivery that didn't happen.
      console.error(
        `[mailer] SMTP not configured; dropping email to ${message.to} (${message.subject})`,
      );
      return { ok: false, error: "email_not_configured" };
    }
    console.log("\n========== EMAIL (dev — not actually sent) ==========");
    console.log(`To:      ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log(message.text);
    console.log("=====================================================\n");
    return { ok: true, messageId: `dev:${Date.now()}` };
  }

  try {
    const info = (await transport.sendMail({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    })) as { messageId?: string };
    return { ok: true, messageId: info.messageId ?? "unknown" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "send_failed";
    console.error(`[mailer] send to ${message.to} failed: ${error}`);
    return { ok: false, error };
  }
}
