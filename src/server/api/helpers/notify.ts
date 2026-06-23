import { type PrismaClient } from "../../../../generated/prisma";

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Record a "your referral was accepted" notification for the resident.
 *
 * Writes a `notification_events` row (the thing that happened) and, when the
 * referral's session belongs to a signed-in resident, a per-user
 * `notification_deliveries` row that surfaces in their account's Updates feed.
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

  const event = await db.notification_events.create({
    data: {
      event_type: "referral_accepted",
      payload: {
        referral_id: referral.id,
        need_category: referral.need_category,
        organization_name: referral.organizations?.name ?? null,
      },
    },
    select: { id: true },
  });

  // Only an account-linked session has a resident to deliver to; anonymous
  // sessions still get the event recorded, just no per-user delivery.
  const userId = referral.screening_sessions?.user_id;
  if (userId) {
    await db.notification_deliveries.create({
      data: {
        notification_event_id: event.id,
        user_id: userId,
        channel: "email",
        delivery_status: "sent",
        delivered_at: new Date(),
      },
    });
  }
}

/**
 * Record a "new message from your caseworker" notification for the resident.
 *
 * Fires when a caseworker posts a resident-visible (non-internal) note. Stores
 * a short preview so the Updates feed has context, and links back to the
 * Messages thread. No-op when the case isn't tied to a resident account.
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
  const event = await db.notification_events.create({
    data: {
      event_type: "caseworker_message",
      payload: { case_id: caseId, preview },
    },
    select: { id: true },
  });
  await db.notification_deliveries.create({
    data: {
      notification_event_id: event.id,
      user_id: userId,
      channel: "email",
      delivery_status: "sent",
      delivered_at: new Date(),
    },
  });
}
