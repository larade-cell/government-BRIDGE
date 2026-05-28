import { TRPCError } from "@trpc/server";

import { type createTRPCContext } from "~/server/api/trpc";

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Load a screening session by id, throw NOT_FOUND if missing, and enforce
 * ownership when the session has been claimed by an account. Anonymous
 * sessions (user_id IS NULL) remain accessible to any caller with the
 * session id — the session-id-as-bearer-token model from Story 1.
 *
 * Returns minimal session metadata so callers can apply further checks
 * (expiry, completion, etc.) without a second query.
 */
export async function assertSessionAccess(ctx: Ctx, sessionId: string) {
  const session = await ctx.db.screening_sessions.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      user_id: true,
      expires_at: true,
      completed_at: true,
    },
  });
  if (!session) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
  }
  if (
    session.user_id !== null &&
    session.user_id !== ctx.session?.user.appUserId
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Session belongs to another user",
    });
  }
  return session;
}
