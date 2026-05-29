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

/** Roles in ascending privilege order. */
export type AppRole = "resident" | "navigator" | "caseworker" | "admin";

/**
 * Require the caller to be signed in AND hold one of `allowed` roles. The
 * NextAuth session only carries `appUserId`, not the domain role, so we look
 * it up. Throws UNAUTHORIZED when not signed in / no domain user, FORBIDDEN
 * when the role is insufficient (mirrors spec §1.9.3 `ROLE_INSUFFICIENT`).
 *
 * Returns the loaded `{ id, role }` so callers can scope further (e.g. a
 * caseworker only seeing their assigned cases).
 */
export async function requireRole(ctx: Ctx, allowed: AppRole[]) {
  const appUserId = ctx.session?.user.appUserId;
  if (!appUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  const user = await ctx.db.users.findUnique({
    where: { id: appUserId },
    select: { id: true, role: true },
  });
  if (!user || !allowed.includes(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your role does not permit this action",
    });
  }
  return user;
}
