import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertSessionAccess } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Notification preferences are dual-scope: an authenticated user owns rows
 * via `user_id`; an anonymous resident owns rows via `session_id`. Both
 * routes accept an optional `sessionId` — when provided, ownership is
 * enforced via `assertSessionAccess`; otherwise the caller must be signed in.
 */

const channelSchema = z.enum(["email", "sms", "whatsapp"]);
const frequencySchema = z.enum([
  "realtime",
  "daily_digest",
  "weekly_digest",
  "important_only",
]);

export const notificationPreferenceRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({ sessionId: z.string().uuid().optional() })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (input?.sessionId) {
        await assertSessionAccess(ctx, input.sessionId);
        return ctx.db.notification_preferences.findMany({
          where: { session_id: input.sessionId },
          orderBy: { created_at: "asc" },
        });
      }
      const appUserId = ctx.session?.user.appUserId;
      if (!appUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in or supply a sessionId",
        });
      }
      return ctx.db.notification_preferences.findMany({
        where: { user_id: appUserId },
        orderBy: { created_at: "asc" },
      });
    }),

  upsert: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid().optional(),
        channel: channelSchema,
        destination: z.string().trim().min(1).max(254),
        languageCode: z.string().min(2).max(8).default("en"),
        frequency: frequencySchema.default("important_only"),
        optedIn: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const update = {
        language_code: input.languageCode,
        frequency: input.frequency,
        opted_in: input.optedIn,
      };

      if (input.sessionId) {
        await assertSessionAccess(ctx, input.sessionId);
        return ctx.db.notification_preferences.upsert({
          where: {
            session_id_channel_destination: {
              session_id: input.sessionId,
              channel: input.channel,
              destination: input.destination,
            },
          },
          update,
          create: {
            ...update,
            session_id: input.sessionId,
            channel: input.channel,
            destination: input.destination,
          },
        });
      }

      const appUserId = ctx.session?.user.appUserId;
      if (!appUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in or supply a sessionId",
        });
      }
      return ctx.db.notification_preferences.upsert({
        where: {
          user_id_channel_destination: {
            user_id: appUserId,
            channel: input.channel,
            destination: input.destination,
          },
        },
        update,
        create: {
          ...update,
          user_id: appUserId,
          channel: input.channel,
          destination: input.destination,
        },
      });
    }),
});
