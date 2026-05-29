import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
});
