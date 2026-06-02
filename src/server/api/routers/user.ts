import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { recordAudit } from "~/server/api/helpers/audit";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { id: authUserId, appUserId } = ctx.session.user;

    const [authUser, appUser] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: authUserId },
        select: { id: true, name: true, email: true, image: true },
      }),
      appUserId
        ? ctx.db.users.findUnique({
            where: { id: appUserId },
            select: {
              id: true,
              role: true,
              preferred_language: true,
              phone: true,
            },
          })
        : null,
    ]);

    return { authUser, appUser };
  }),

  update: protectedProcedure
    .input(
      z.object({
        preferred_language: z.string().min(2).max(8).optional(),
        phone: z.string().trim().min(1).max(32).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { appUserId } = ctx.session.user;
      if (!appUserId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No domain user is linked to this account yet",
        });
      }

      if (input.preferred_language !== undefined) {
        const lang = await ctx.db.languages.findUnique({
          where: { code: input.preferred_language },
          select: { code: true },
        });
        if (!lang) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unsupported language code: ${input.preferred_language}`,
          });
        }
      }

      const updated = await ctx.db.users.update({
        where: { id: appUserId },
        data: {
          ...(input.preferred_language !== undefined && {
            preferred_language: input.preferred_language,
          }),
          ...(input.phone !== undefined && { phone: input.phone }),
        },
        select: {
          id: true,
          role: true,
          preferred_language: true,
          phone: true,
        },
      });
      return updated;
    }),

  /**
   * Delete the caller's own account (right to erasure). Removes personal data
   * (screening sessions and everything they cascade — answers, results,
   * uploads, conversations, cases, referrals — plus user-scoped conversations,
   * notification prefs, searches, addresses, login sessions) and the sign-in
   * identity, then scrubs PII from the domain row. The (now anonymous, login-
   * less) `users` row is kept so operational attributions written by staff
   * accounts — audit entries, authored case notes, rule versions — stay valid.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const appUserId = ctx.session.user.appUserId;
    const authUserId = ctx.session.user.id;

    if (!appUserId) {
      // No linked domain user — just remove the sign-in identity.
      await ctx.db.user.deleteMany({ where: { id: authUserId } });
      return { deleted: true };
    }

    // Audit before we scrub (the actor row still exists and stays, anonymized).
    await recordAudit(ctx, {
      action: "account.delete",
      entity_type: "user",
      entity_id: appUserId,
    });

    await ctx.db.$transaction(async (tx) => {
      // Cases opened from this user's chat conversations (no screening session)
      // would otherwise be orphaned with the resident's contact PII — remove
      // them before the conversations go.
      const convoIds = (
        await tx.ai_conversations.findMany({
          where: { user_id: appUserId },
          select: { id: true },
        })
      ).map((c) => c.id);
      if (convoIds.length > 0) {
        await tx.cases.deleteMany({
          where: { conversation_id: { in: convoIds } },
        });
      }

      // Owned screening sessions cascade to answers, results, uploads,
      // session-scoped conversations, cases, and referrals.
      await tx.screening_sessions.deleteMany({ where: { user_id: appUserId } });
      await tx.ai_conversations.deleteMany({ where: { user_id: appUserId } });
      await tx.notification_preferences.deleteMany({
        where: { user_id: appUserId },
      });
      await tx.search_queries.deleteMany({ where: { user_id: appUserId } });
      await tx.addresses.deleteMany({ where: { user_id: appUserId } });
      await tx.user_sessions.deleteMany({ where: { user_id: appUserId } });

      // Scrub PII and sever the login (NextAuth user delete cascades its
      // accounts/sessions and SetNulls users.auth_user_id).
      await tx.users.update({
        where: { id: appUserId },
        data: { email: null, phone: null },
      });
      await tx.user.deleteMany({ where: { id: authUserId } });
    });

    return { deleted: true };
  }),
});
