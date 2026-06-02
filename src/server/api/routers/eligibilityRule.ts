import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type Prisma } from "../../../../generated/prisma";
import { recordAudit } from "~/server/api/helpers/audit";
import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Eligibility rule versioning (Story 20). Admin-only. Rules are version
 * controlled and auditable; previous versions stay accessible.
 *
 * "Published" is modeled by `effective_from`: a draft is parked on a
 * far-future sentinel date and goes live when published (set to today),
 * which also closes the previously-current version's `effective_to`. This
 * keeps full history without a destructive overwrite (Story 20 criteria).
 */

const DRAFT_SENTINEL = new Date("9999-12-31T00:00:00.000Z");

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isPublished(effectiveFrom: Date) {
  return effectiveFrom.getTime() <= startOfToday().getTime();
}

export const eligibilityRuleRouter = createTRPCRouter({
  listVersions: publicProcedure
    .input(z.object({ program_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const versions = await ctx.db.eligibility_rule_versions.findMany({
        where: { program_id: input.program_id },
        orderBy: { version: "desc" },
      });
      return {
        data: versions.map((v) => ({
          ...v,
          is_published: isPublished(v.effective_from),
        })),
      };
    }),

  createVersion: publicProcedure
    .input(
      z.object({
        program_id: z.string().uuid(),
        rules_json: z.record(z.string(), z.unknown()),
        false_positive_bias: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, ["admin"]);

      const program = await ctx.db.programs.findUnique({
        where: { id: input.program_id },
        select: { id: true },
      });
      if (!program) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Program not found" });
      }

      const latest = await ctx.db.eligibility_rule_versions.findFirst({
        where: { program_id: input.program_id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const version = await ctx.db.eligibility_rule_versions.create({
        data: {
          program_id: input.program_id,
          version: (latest?.version ?? 0) + 1,
          rules_json: input.rules_json as Prisma.InputJsonValue,
          false_positive_bias: input.false_positive_bias,
          effective_from: DRAFT_SENTINEL,
          created_by: staff.id,
        },
      });
      await recordAudit(ctx, {
        action: "rule.create_version",
        entity_type: "eligibility_rule_version",
        entity_id: version.id,
        after: { program_id: version.program_id, version: version.version },
      });
      return version;
    }),

  publish: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);

      const version = await ctx.db.eligibility_rule_versions.findUnique({
        where: { id: input.id },
        select: { id: true, program_id: true, effective_from: true },
      });
      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule version not found",
        });
      }
      if (isPublished(version.effective_from)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Rule version is already published",
        });
      }

      const today = startOfToday();

      // Story 20: rule updates don't require downtime — close the prior live
      // version and open this one in a single transaction.
      const [, published] = await ctx.db.$transaction([
        ctx.db.eligibility_rule_versions.updateMany({
          where: {
            program_id: version.program_id,
            effective_to: null,
            effective_from: { lte: today },
            id: { not: version.id },
          },
          data: { effective_to: today },
        }),
        ctx.db.eligibility_rule_versions.update({
          where: { id: version.id },
          data: { effective_from: today },
        }),
      ]);

      await recordAudit(ctx, {
        action: "rule.publish",
        entity_type: "eligibility_rule_version",
        entity_id: published.id,
        after: { program_id: published.program_id, version: published.version },
      });
      return { ...published, is_published: true };
    }),
});
