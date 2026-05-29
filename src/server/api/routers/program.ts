import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Programs catalog (Story 6/7/10) and document-type reference (Story 8).
 *
 * Reads are public. Translated content is selected by `language_code`,
 * falling back to the stable key when a translation row is missing.
 *
 * Field naming is snake_case in and out — it matches the Prisma/Postgres
 * layer and the rest of this API (see docs/api-spec.md §1.2).
 */

const langSchema = z.string().min(2).max(8).default("en");
const pageSchema = z.number().int().min(1).default(1);
const limitSchema = z.number().int().min(1).max(100).default(20);

function flattenProgram(
  p: {
    id: string;
    program_key: string;
    category: string;
    authoritative_url: string;
    is_active: boolean;
    created_at: Date;
    program_translations: {
      name: string;
      short_description: string;
      next_steps: string;
    }[];
    program_life_events?: { life_events: { event_key: string } }[];
  },
  includeLifeEvents = false,
) {
  return {
    id: p.id,
    program_key: p.program_key,
    category: p.category,
    authoritative_url: p.authoritative_url,
    is_active: p.is_active,
    created_at: p.created_at,
    name: p.program_translations[0]?.name ?? p.program_key,
    short_description: p.program_translations[0]?.short_description ?? null,
    next_steps: p.program_translations[0]?.next_steps ?? null,
    ...(includeLifeEvents &&
      p.program_life_events && {
        life_events: p.program_life_events.map((e) => e.life_events.event_key),
      }),
  };
}

export const programRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          language_code: langSchema,
          category: z.string().trim().min(1).max(64).optional(),
          is_active: z.boolean().default(true),
          life_event: z.string().trim().min(1).max(64).optional(),
          include_life_events: z.boolean().default(false),
          page: pageSchema,
          limit: limitSchema,
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        is_active: input.is_active,
        ...(input.category && { category: input.category }),
        ...(input.life_event && {
          program_life_events: {
            some: { life_events: { event_key: input.life_event } },
          },
        }),
      };

      const [total, rows] = await Promise.all([
        ctx.db.programs.count({ where }),
        ctx.db.programs.findMany({
          where,
          orderBy: { program_key: "asc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            program_key: true,
            category: true,
            authoritative_url: true,
            is_active: true,
            created_at: true,
            program_translations: {
              where: { language_code: input.language_code },
              select: { name: true, short_description: true, next_steps: true },
              take: 1,
            },
            program_life_events: {
              select: { life_events: { select: { event_key: true } } },
            },
          },
        }),
      ]);

      return {
        data: rows.map((p) => flattenProgram(p, input.include_life_events)),
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          total_pages: Math.ceil(total / input.limit),
          language: input.language_code,
        },
      };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), language_code: langSchema }))
    .query(async ({ ctx, input }) => {
      const program = await ctx.db.programs.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          program_key: true,
          category: true,
          authoritative_url: true,
          is_active: true,
          created_at: true,
          program_translations: {
            where: { language_code: input.language_code },
            select: { name: true, short_description: true, next_steps: true },
            take: 1,
          },
          program_life_events: {
            select: { life_events: { select: { event_key: true } } },
          },
        },
      });
      if (!program) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Program not found" });
      }
      return flattenProgram(program, true);
    }),

  /**
   * Natural-language search over programs (Story 14). Uses the Postgres
   * full-text `search_vector` GIN index. `websearch_to_tsquery` accepts plain
   * user phrases. Returns ranked program summaries; if `search_vector` has not
   * been populated yet the result set is simply empty (the route is wired,
   * indexing is a separate data task).
   */
  search: publicProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(200),
        language_code: langSchema,
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ranked = await ctx.db.$queryRaw<{ id: string; rank: number }[]>`
        SELECT id, ts_rank(search_vector, websearch_to_tsquery('english', ${input.q})) AS rank
        FROM programs
        WHERE is_active = true
          AND search_vector @@ websearch_to_tsquery('english', ${input.q})
        ORDER BY rank DESC
        LIMIT ${input.limit}
      `;

      if (ranked.length === 0) {
        return {
          data: [],
          meta: { query: input.q, language: input.language_code, count: 0 },
        };
      }

      const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
      const programs = await ctx.db.programs.findMany({
        where: { id: { in: ranked.map((r) => r.id) } },
        select: {
          id: true,
          program_key: true,
          category: true,
          authoritative_url: true,
          is_active: true,
          created_at: true,
          program_translations: {
            where: { language_code: input.language_code },
            select: { name: true, short_description: true, next_steps: true },
            take: 1,
          },
        },
      });

      const data = programs
        .map((p) => ({
          target_type: "program" as const,
          target_id: p.id,
          score: rankById.get(p.id) ?? 0,
          program: flattenProgram(p),
        }))
        .sort((a, b) => b.score - a.score);

      return {
        data,
        meta: { query: input.q, language: input.language_code, count: data.length },
      };
    }),
});

function flattenDocumentType(d: {
  id: string;
  doc_key: string;
  category: string;
  document_type_translations: {
    name: string;
    description: string | null;
    examples: string | null;
  }[];
}) {
  return {
    id: d.id,
    doc_key: d.doc_key,
    category: d.category,
    name: d.document_type_translations[0]?.name ?? d.doc_key,
    description: d.document_type_translations[0]?.description ?? null,
    examples: d.document_type_translations[0]?.examples ?? null,
  };
}

export const documentTypeRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ language_code: langSchema }).default({}))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.document_types.findMany({
        orderBy: { doc_key: "asc" },
        select: {
          id: true,
          doc_key: true,
          category: true,
          document_type_translations: {
            where: { language_code: input.language_code },
            select: { name: true, description: true, examples: true },
            take: 1,
          },
        },
      });
      return { data: rows.map(flattenDocumentType), meta: { language: input.language_code } };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid(), language_code: langSchema }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.document_types.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          doc_key: true,
          category: true,
          document_type_translations: {
            where: { language_code: input.language_code },
            select: { name: true, description: true, examples: true },
            take: 1,
          },
        },
      });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document type not found",
        });
      }
      return flattenDocumentType(row);
    }),
});
