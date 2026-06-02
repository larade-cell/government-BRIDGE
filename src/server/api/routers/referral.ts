import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type createTRPCContext } from "~/server/api/trpc";
import { assertSessionAccess } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Referrals connect a screening session to an organization (or capture a
 * pending in-person help request when `organizationId` is null). Reads can
 * be scoped two ways: by `sessionId` (anonymous-friendly) or by the
 * authenticated user (joining through screening_sessions.user_id).
 *
 * Detail/update are accessible to staff (caseworkers/admins manage referrals)
 * or to the session owner.
 */

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;
const referralStatus = z.enum(["draft", "sent", "accepted", "closed"]);

async function callerIsStaff(ctx: Ctx): Promise<boolean> {
  const appUserId = ctx.session?.user.appUserId;
  if (!appUserId) return false;
  const user = await ctx.db.users.findUnique({
    where: { id: appUserId },
    select: { role: true },
  });
  return user?.role === "caseworker" || user?.role === "admin";
}

export const referralRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        organization_id: z.string().uuid().nullable().optional(),
        need_category: z.string().trim().min(1).max(64),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Staff can open a referral for any session (e.g. from the case view);
      // otherwise the caller must own/hold the session.
      if (await callerIsStaff(ctx)) {
        const session = await ctx.db.screening_sessions.findUnique({
          where: { id: input.session_id },
          select: { id: true },
        });
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        }
      } else {
        await assertSessionAccess(ctx, input.session_id);
      }

      if (input.organization_id) {
        const org = await ctx.db.organizations.findUnique({
          where: { id: input.organization_id },
          select: { id: true },
        });
        if (!org) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
          });
        }
      }

      return ctx.db.referrals.create({
        data: {
          session_id: input.session_id,
          organization_id: input.organization_id ?? null,
          need_category: input.need_category,
          notes: input.notes ?? null,
        },
      });
    }),

  list: publicProcedure
    .input(
      z
        .object({ session_id: z.string().uuid().optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.session_id) {
        await assertSessionAccess(ctx, input.session_id);
        return ctx.db.referrals.findMany({
          where: { session_id: input.session_id },
          orderBy: { created_at: "desc" },
          include: { organizations: true },
        });
      }
      const appUserId = ctx.session?.user.appUserId;
      if (!appUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in or supply a sessionId",
        });
      }
      return ctx.db.referrals.findMany({
        where: { screening_sessions: { user_id: appUserId } },
        orderBy: { created_at: "desc" },
        include: { organizations: true },
      });
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const referral = await ctx.db.referrals.findUnique({
        where: { id: input.id },
        include: { organizations: true },
      });
      if (!referral) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      }
      if (!(await callerIsStaff(ctx))) {
        await assertSessionAccess(ctx, referral.session_id);
      }
      return referral;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        organization_id: z.string().uuid().nullable().optional(),
        need_category: z.string().trim().min(1).max(64).optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
        status: referralStatus.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referrals.findUnique({
        where: { id: input.id },
        select: { id: true, session_id: true, sent_at: true },
      });
      if (!referral) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      }
      if (!(await callerIsStaff(ctx))) {
        await assertSessionAccess(ctx, referral.session_id);
      }
      if (input.organization_id) {
        const org = await ctx.db.organizations.findUnique({
          where: { id: input.organization_id },
          select: { id: true },
        });
        if (!org) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
        }
      }
      // Stamp sent_at the first time a referral is marked sent.
      const stampSent = input.status === "sent" && !referral.sent_at;
      return ctx.db.referrals.update({
        where: { id: input.id },
        data: {
          ...(input.organization_id !== undefined && {
            organization_id: input.organization_id,
          }),
          ...(input.need_category !== undefined && {
            need_category: input.need_category,
          }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(input.status !== undefined && { status: input.status }),
          ...(stampSent && { sent_at: new Date() }),
        },
        include: { organizations: true },
      });
    }),

  /** Soft-delete the referral by marking it closed (staff only). */
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!(await callerIsStaff(ctx))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only staff can delete referrals" });
      }
      const existing = await ctx.db.referrals.findUnique({ where: { id: input.id }, select: { id: true } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      }
      return ctx.db.referrals.update({ where: { id: input.id }, data: { status: "closed" } });
    }),

  /** Send a referral (stamp `sent_at` and mark `sent` status). */
  send: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referrals.findUnique({ where: { id: input.id }, select: { id: true, session_id: true, sent_at: true } });
      if (!referral) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Referral not found" });
      }
      if (!(await callerIsStaff(ctx))) {
        await assertSessionAccess(ctx, referral.session_id);
      }
      const stampSent = !referral.sent_at;
      const updated = await ctx.db.referrals.update({ where: { id: input.id }, data: { status: "sent", ...(stampSent && { sent_at: new Date() }) }, include: { organizations: true } });
      return updated;
    }),
});
