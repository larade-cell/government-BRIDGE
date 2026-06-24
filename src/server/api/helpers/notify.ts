import {
  type Prisma,
  type PrismaClient,
  type notification_delivery_status,
} from "../../../../generated/prisma";
import { sendMail } from "~/server/lib/mailer";

/** A Prisma client or an interactive-transaction client. */
type Db =
  | PrismaClient
  | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Localized subject + body for one notification, keyed by language code. */
type Rendered = { subject: string; text: string };
type Render = (lang: string) => Rendered;

/**
 * Record a notification event and, for an account-linked resident, deliver it
 * by email and persist a per-user `notification_deliveries` row.
 *
 * The delivery row doubles as the resident's in-app "Updates" feed entry, so it
 * is always written when there's a resident — even when no email is sent. The
 * `delivery_status` reflects what actually happened:
 *  - `sent`    — the email transport accepted the message
 *  - `failed`  — the send was attempted and errored (or SMTP isn't configured
 *                in production)
 *  - `pending` — no email was attempted (no address on file, or the resident
 *                opted out of the email channel); the feed entry still exists
 *
 * Recipient address and language are taken from the resident's opted-in email
 * preference when present, otherwise from their account email + preferred
 * language. Anonymous sessions get the event recorded but no per-user delivery.
 */
async function deliver(
  db: Db,
  args: {
    eventType: string;
    payload: Prisma.InputJsonObject;
    userId: string | null | undefined;
    render: Render;
  },
): Promise<void> {
  const event = await db.notification_events.create({
    data: { event_type: args.eventType, payload: args.payload },
    select: { id: true },
  });

  if (!args.userId) return;
  const userId = args.userId;

  // Prefer an explicit email preference (carries destination + language + the
  // opt-out flag); fall back to the account email and preferred language.
  const [pref, user] = await Promise.all([
    db.notification_preferences.findFirst({
      where: { user_id: userId, channel: "email" },
      select: { destination: true, language_code: true, opted_in: true },
    }),
    db.users.findUnique({
      where: { id: userId },
      select: { email: true, preferred_language: true },
    }),
  ]);

  const optedOut = pref ? !pref.opted_in : false;
  const to = pref?.destination ?? user?.email ?? null;
  const lang = pref?.language_code ?? user?.preferred_language ?? "en";

  let status: notification_delivery_status = "pending";
  let providerMessageId: string | null = null;
  let deliveredAt: Date | null = null;

  if (to && !optedOut) {
    const { subject, text } = args.render(lang);
    const result = await sendMail({ to, subject, text });
    if (result.ok) {
      status = "sent";
      providerMessageId = result.messageId;
      deliveredAt = new Date();
    } else {
      status = "failed";
    }
  }

  await db.notification_deliveries.create({
    data: {
      notification_event_id: event.id,
      user_id: userId,
      channel: "email",
      delivery_status: status,
      provider_message_id: providerMessageId,
      delivered_at: deliveredAt,
    },
  });
}

// NOTE: transactional email copy lives here rather than the client i18n
// catalogs (src/i18n/messages) because it's rendered server-side. New languages
// should be added here and there together.
function renderReferralAccepted(orgName: string | null): Render {
  const org = orgName ?? "an organization";
  return (lang) =>
    lang === "es"
      ? {
          subject: "Su referencia fue aceptada",
          text: `Buenas noticias: ${org} aceptó su referencia. Inicie sesión en su cuenta para ver los próximos pasos.`,
        }
      : {
          subject: "Your referral was accepted",
          text: `Good news — ${org} accepted your referral. Sign in to your account to see the next steps.`,
        };
}

function renderCaseworkerMessage(preview: string): Render {
  return (lang) =>
    lang === "es"
      ? {
          subject: "Nuevo mensaje de su trabajador social",
          text: `Su trabajador social le envió un mensaje: "${preview}". Inicie sesión en su cuenta para responder.`,
        }
      : {
          subject: "New message from your caseworker",
          text: `Your caseworker sent you a message: "${preview}". Sign in to your account to reply.`,
        };
}

/**
 * Record + deliver a "your referral was accepted" notification for the resident.
 * Best-effort and idempotent at the call site (referral.update only fires this
 * on the transition *into* accepted), so it never blocks the status change.
 */
export async function notifyReferralAccepted(
  db: Db,
  referralId: string,
): Promise<void> {
  const referral = await db.referrals.findUnique({
    where: { id: referralId },
    select: {
      id: true,
      need_category: true,
      organizations: { select: { name: true } },
      screening_sessions: { select: { user_id: true } },
    },
  });
  if (!referral) return;

  await deliver(db, {
    eventType: "referral_accepted",
    payload: {
      referral_id: referral.id,
      need_category: referral.need_category,
      organization_name: referral.organizations?.name ?? null,
    },
    userId: referral.screening_sessions?.user_id,
    render: renderReferralAccepted(referral.organizations?.name ?? null),
  });
}

/**
 * Record + deliver a "new message from your caseworker" notification. Fires when
 * a caseworker posts a resident-visible (non-internal) note. No-op when the case
 * isn't tied to a resident account.
 */
export async function notifyCaseworkerMessage(
  db: Db,
  caseId: string,
  message: string,
): Promise<void> {
  const kase = await db.cases.findUnique({
    where: { id: caseId },
    select: { id: true, screening_sessions: { select: { user_id: true } } },
  });
  const userId = kase?.screening_sessions?.user_id;
  if (!userId) return;

  const preview = message.length > 120 ? `${message.slice(0, 117)}…` : message;
  await deliver(db, {
    eventType: "caseworker_message",
    payload: { case_id: caseId, preview },
    userId,
    render: renderCaseworkerMessage(preview),
  });
}
