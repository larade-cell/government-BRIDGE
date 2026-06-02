import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const pageSchema = z.number().int().min(1).default(1);
const limitSchema = z.number().int().min(1).max(100).default(20);

export const searchRouter = createTRPCRouter({
  organizations: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).optional(), page: pageSchema, limit: limitSchema }).default({}))
    .query(async ({ ctx, input }) => {
      const where = input.q
        ? {
            OR: [
              { name: { contains: input.q } },
              { service_categories: { has: input.q } },
            ],
          }
        : undefined;
      const [total, rows] = await Promise.all([
        ctx.db.organizations.count({ where }),
        ctx.db.organizations.findMany({ where, orderBy: { name: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
      ]);
      return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
    }),

  questions: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).optional(), page: pageSchema, limit: limitSchema }).default({}))
    .query(async ({ ctx, input }) => {
      if (!input.q) return { data: [], meta: { page: input.page, limit: input.limit, total: 0, total_pages: 1 } };
      const where = { question_translations: { some: { prompt: { contains: input.q } } } };
      const [total, rows] = await Promise.all([
        ctx.db.questions.count({ where }),
        ctx.db.questions.findMany({ where, orderBy: { id: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
      ]);
      return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
    }),

  cases: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).optional(), page: pageSchema, limit: limitSchema }).default({}))
    .query(async ({ ctx, input }) => {
      const where = input.q
        ? { case_notes: { some: { note: { contains: input.q } } } }
        : undefined;
      const [total, rows] = await Promise.all([
        ctx.db.cases.count({ where }),
        ctx.db.cases.findMany({ where, orderBy: { created_at: "desc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
      ]);
      return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
    }),

  auditLogs: publicProcedure
    .input(z.object({ q: z.string().trim().min(1).optional(), page: pageSchema, limit: limitSchema }).default({}))
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      if (!input.q) return { data: [], meta: { page: input.page, limit: input.limit, total: 0, total_pages: 1 } };
      const where = { OR: [ { action: { contains: input.q } }, { entity_type: { contains: input.q } } ] };
      const [total, rows] = await Promise.all([
        ctx.db.audit_logs.count({ where }),
        ctx.db.audit_logs.findMany({ where, orderBy: { created_at: "desc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
      ]);
      return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
    }),

  // Advanced dispatch: POST /search with `entity` and `q`.
  dispatch: publicProcedure
    .input(z.object({ entity: z.string().trim(), q: z.string().trim().min(1), page: pageSchema, limit: limitSchema }))
    .query(async ({ ctx, input }) => {
      switch (input.entity) {
        case "programs": {
          const where = { program_translations: { some: { name: { contains: input.q } } } };
          const [total, rows] = await Promise.all([
            ctx.db.programs.count({ where }),
            ctx.db.programs.findMany({ where, orderBy: { program_key: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
          ]);
          return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
        }
        case "organizations": {
          const where = { OR: [ { name: { contains: input.q } }, { service_categories: { has: input.q } } ] };
          const [total, rows] = await Promise.all([
            ctx.db.organizations.count({ where }),
            ctx.db.organizations.findMany({ where, orderBy: { name: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
          ]);
          return { data: rows, meta: { page: input.page, limit: input.limit, total, total_pages: Math.max(1, Math.ceil(total / input.limit)) } };
        }
        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: `Unknown search entity: ${input.entity}` });
      }
    }),
});

export default searchRouter;
