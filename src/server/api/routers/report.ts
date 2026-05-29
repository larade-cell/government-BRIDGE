import { z } from "zod";

import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Staff reporting (Stories 18/20). Every procedure is role-gated to
 * caseworker/admin via `requireRole`. Reads aggregate counts only — no PII.
 *
 * These run real aggregate queries against the live data so they are useful
 * and testable; CSV export and async jobs (spec §3.19 Phase 3) are deferred.
 */

const STAFF = ["caseworker", "admin"] as const;

const dateRangeSchema = z
  .object({
    start_date: z.coerce.date().optional(),
    end_date: z.coerce.date().optional(),
  })
  .default({});

function rangeFilter(input: { start_date?: Date; end_date?: Date }) {
  if (!input.start_date && !input.end_date) return undefined;
  return {
    created_at: {
      ...(input.start_date && { gte: input.start_date }),
      ...(input.end_date && { lte: input.end_date }),
    },
  };
}

export const reportRouter = createTRPCRouter({
  overview: publicProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const where = rangeFilter(input);

      const [
        totalSessions,
        completedSessions,
        totalResults,
        totalUploads,
        openCases,
      ] = await Promise.all([
        ctx.db.screening_sessions.count({ where }),
        ctx.db.screening_sessions.count({
          where: { ...where, completed_at: { not: null } },
        }),
        ctx.db.eligibility_results.count({ where }),
        ctx.db.document_uploads.count({
          where: { ...where, status: { not: "deleted" } },
        }),
        ctx.db.cases.count({
          where: { ...where, status: { in: ["new", "in_progress"] } },
        }),
      ]);

      return {
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        completion_rate:
          totalSessions === 0 ? 0 : completedSessions / totalSessions,
        total_eligibility_results: totalResults,
        total_uploads: totalUploads,
        open_cases: openCases,
      };
    }),

  eligibilityOutcomes: publicProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const grouped = await ctx.db.eligibility_results.groupBy({
        by: ["outcome"],
        where: rangeFilter(input),
        _count: { _all: true },
      });
      return {
        data: grouped.map((g) => ({
          outcome: g.outcome,
          count: g._count._all,
        })),
      };
    }),

  completionRate: publicProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const where = rangeFilter(input);
      const [started, completed] = await Promise.all([
        ctx.db.screening_sessions.count({ where }),
        ctx.db.screening_sessions.count({
          where: { ...where, completed_at: { not: null } },
        }),
      ]);
      return {
        started,
        completed,
        rate: started === 0 ? 0 : completed / started,
      };
    }),

  dropOff: publicProcedure
    .input(dateRangeSchema)
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const grouped = await ctx.db.screening_sessions.groupBy({
        by: ["current_step"],
        where: { ...rangeFilter(input), completed_at: null },
        _count: { _all: true },
        orderBy: { current_step: "asc" },
      });
      return {
        data: grouped.map((g) => ({
          step: g.current_step ?? 0,
          count: g._count._all,
        })),
      };
    }),
});
