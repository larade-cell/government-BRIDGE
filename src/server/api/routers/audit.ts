import { z } from "zod";

import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Read-only audit trail (admin only). Entries are written by `recordAudit` from
 * the sensitive mutations (rule publishing, catalog/knowledge edits, case
 * changes). Append-only — there's intentionally no write/delete procedure here.
 */
export const auditRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          entity_type: z.string().optional(),
          action: z.string().optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const where = {
        ...(input.entity_type && { entity_type: input.entity_type }),
        ...(input.action && { action: input.action }),
      };
      const [total, rows] = await Promise.all([
        ctx.db.audit_logs.count({ where }),
        ctx.db.audit_logs.findMany({
          where,
          orderBy: { created_at: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            action: true,
            entity_type: true,
            entity_id: true,
            before_value: true,
            after_value: true,
            ip_address: true,
            created_at: true,
            users: { select: { email: true, role: true } },
          },
        }),
      ]);
      return {
        data: rows.map((r) => ({
          id: r.id,
          action: r.action,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          before_value: r.before_value,
          after_value: r.after_value,
          ip_address: r.ip_address,
          created_at: r.created_at,
          actor: r.users
            ? { email: r.users.email, role: r.users.role }
            : null,
        })),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          total_pages: Math.max(1, Math.ceil(total / input.limit)),
        },
      };
    }),

  /** Distinct entity types present, for the filter dropdown. */
  facets: publicProcedure.query(async ({ ctx }) => {
    await requireRole(ctx, ["admin"]);
    const types = await ctx.db.audit_logs.findMany({
      distinct: ["entity_type"],
      select: { entity_type: true },
      orderBy: { entity_type: "asc" },
    });
    return { entity_types: types.map((t) => t.entity_type) };
  }),
});
