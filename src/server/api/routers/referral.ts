import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertSessionAccess } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Referrals connect a screening session to an organization (or capture a
 * pending in-person help request when `organizationId` is null). Reads can
 * be scoped two ways: by `sessionId` (anonymous-friendly) or by the
 * authenticated user (joining through screening_sessions.user_id).
 */

export const referralRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        organizationId: z.string().uuid().nullable().optional(),
        needCategory: z.string().trim().min(1).max(64),
        notes: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.sessionId);

      if (input.organizationId) {
        const org = await ctx.db.organizations.findUnique({
          where: { id: input.organizationId },
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
          session_id: input.sessionId,
          organization_id: input.organizationId ?? null,
          need_category: input.needCategory,
          notes: input.notes ?? null,
        },
      });
    }),

  list: publicProcedure
    .input(
      z
        .object({ sessionId: z.string().uuid().optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.sessionId) {
        await assertSessionAccess(ctx, input.sessionId);
        return ctx.db.referrals.findMany({
          where: { session_id: input.sessionId },
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
});
