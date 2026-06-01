import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type PrismaClient } from "../../../../generated/prisma";
import { embedText, isAiEnabled } from "../../../../lib/ai-service";
import { requireRole } from "~/server/api/helpers/session";
import { parseProgramRules } from "~/server/lib/eligibility";
import {
  createTRPCRouter,
  publicProcedure,
  searchProcedure,
} from "~/server/api/trpc";
import { type createTRPCContext } from "~/server/api/trpc";

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;

// ---- Admin program authoring ---------------------------------------------
const programKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits, and underscores only");

const programTranslationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  short_description: z.string().trim().min(1).max(2000),
  next_steps: z.string().trim().min(1).max(2000),
});
const programTranslationsSchema = z.object({
  en: programTranslationSchema,
  es: programTranslationSchema.optional(),
});

async function writeProgramTranslations(
  db: PrismaClient,
  programId: string,
  translations: z.infer<typeof programTranslationsSchema>,
) {
  for (const [language_code, t] of Object.entries(translations)) {
    if (!t) continue;
    await db.program_translations.upsert({
      where: { program_id_language_code: { program_id: programId, language_code } },
      update: {
        name: t.name,
        short_description: t.short_description,
        next_steps: t.next_steps,
      },
      create: {
        program_id: programId,
        language_code,
        name: t.name,
        short_description: t.short_description,
        next_steps: t.next_steps,
      },
    });
  }
}

/** Rebuild the full-text index for one program from its translations. */
async function refreshProgramSearchVector(db: PrismaClient, programId: string) {
  await db.$executeRaw`
    UPDATE programs p SET search_vector = (
      SELECT to_tsvector('english',
        coalesce(string_agg(pt.name, ' '), '') || ' ' ||
        coalesce(string_agg(pt.short_description, ' '), '')
      )
      FROM program_translations pt WHERE pt.program_id = p.id
    ) WHERE p.id = ${programId}::uuid`;
}

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

const searchInput = z.object({
  q: z.string().trim().min(1).max(200),
  language_code: langSchema,
  limit: z.number().int().min(1).max(50).default(10),
});
type SearchInput = z.infer<typeof searchInput>;

/**
 * Rank programs for a query, returning a `programId -> score` map. Prefers
 * semantic (vector) search when embeddings are indexed for the language;
 * otherwise falls back to the Postgres full-text `search_vector` index. An
 * empty map means no matches (or nothing indexed yet) — the route then returns
 * an empty envelope.
 */
async function rankPrograms(
  ctx: Ctx,
  input: SearchInput,
): Promise<Map<string, number>> {
  if (isAiEnabled()) {
    const indexed = await ctx.db.search_embeddings.count({
      where: { target_type: "program", language_code: input.language_code },
    });
    if (indexed > 0) {
      const queryVec = await embedText(input.q);
      if (queryVec) {
        const literal = `[${queryVec.join(",")}]`;
        const rows = await ctx.db.$queryRaw<{ id: string; score: number }[]>`
          SELECT se.target_id::text                  AS id,
                 1 - (se.embedding <=> ${literal}::vector) AS score
          FROM search_embeddings se
          JOIN programs p ON p.id = se.target_id
          WHERE se.target_type = 'program'
            AND se.language_code = ${input.language_code}
            AND p.is_active = true
          ORDER BY se.embedding <=> ${literal}::vector
          LIMIT ${input.limit}
        `;
        if (rows.length > 0) {
          return new Map(rows.map((r) => [r.id, Number(r.score)]));
        }
      }
    }
  }

  // Full-text fallback. `websearch_to_tsquery` accepts plain user phrases. If
  // `search_vector` is unpopulated the result set is simply empty.
  const ranked = await ctx.db.$queryRaw<{ id: string; rank: number }[]>`
    SELECT id, ts_rank(search_vector, websearch_to_tsquery('english', ${input.q})) AS rank
    FROM programs
    WHERE is_active = true
      AND search_vector @@ websearch_to_tsquery('english', ${input.q})
    ORDER BY rank DESC
    LIMIT ${input.limit}
  `;
  return new Map(ranked.map((r) => [r.id, Number(r.rank)]));
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
   * Natural-language search over programs (Story 14). Uses semantic vector
   * search when program embeddings are indexed for the language, otherwise the
   * Postgres full-text `search_vector` GIN index (see `rankPrograms`). Returns
   * ranked program summaries; an empty result set means no matches or nothing
   * indexed yet.
   */
  search: searchProcedure
    .input(searchInput)
    .query(async ({ ctx, input }) => {
      const rankById = await rankPrograms(ctx, input);

      if (rankById.size === 0) {
        return {
          data: [],
          meta: { query: input.q, language: input.language_code, count: 0 },
        };
      }

      const programs = await ctx.db.programs.findMany({
        where: { id: { in: [...rankById.keys()] } },
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

  /**
   * Admin catalog listing — every program (active and inactive) with its
   * English name and a summary of its latest eligibility rule version. Powers
   * the admin programs + rules screens.
   */
  adminList: publicProcedure.query(async ({ ctx }) => {
    await requireRole(ctx, ["admin"]);
    const rows = await ctx.db.programs.findMany({
      orderBy: { program_key: "asc" },
      select: {
        id: true,
        program_key: true,
        category: true,
        authoritative_url: true,
        is_active: true,
        created_at: true,
        program_translations: {
          where: { language_code: "en" },
          select: { name: true, short_description: true },
          take: 1,
        },
        eligibility_rule_versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            effective_from: true,
            false_positive_bias: true,
            rules_json: true,
          },
        },
      },
    });
    const now = Date.now();
    return rows.map((p) => {
      const latest = p.eligibility_rule_versions[0];
      const parsed = latest ? parseProgramRules(latest.rules_json) : null;
      return {
        id: p.id,
        program_key: p.program_key,
        category: p.category,
        authoritative_url: p.authoritative_url,
        is_active: p.is_active,
        created_at: p.created_at,
        name: p.program_translations[0]?.name ?? p.program_key,
        short_description: p.program_translations[0]?.short_description ?? null,
        latest_rule_version: latest
          ? {
              id: latest.id,
              version: latest.version,
              is_published: latest.effective_from.getTime() <= now,
              false_positive_bias: latest.false_positive_bias,
              states: parsed?.states ? Object.keys(parsed.states) : [],
            }
          : null,
      };
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        program_key: programKeySchema,
        category: z.string().trim().min(1).max(64),
        authoritative_url: z.string().url().max(500),
        translations: programTranslationsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const dup = await ctx.db.programs.findUnique({
        where: { program_key: input.program_key },
        select: { id: true },
      });
      if (dup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A program with key "${input.program_key}" already exists`,
        });
      }
      const program = await ctx.db.programs.create({
        data: {
          program_key: input.program_key,
          category: input.category,
          authoritative_url: input.authoritative_url,
        },
        select: { id: true },
      });
      await writeProgramTranslations(ctx.db, program.id, input.translations);
      await refreshProgramSearchVector(ctx.db, program.id);
      return { id: program.id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        category: z.string().trim().min(1).max(64).optional(),
        authoritative_url: z.string().url().max(500).optional(),
        is_active: z.boolean().optional(),
        translations: programTranslationsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.programs.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Program not found" });
      }
      await ctx.db.programs.update({
        where: { id: input.id },
        data: {
          ...(input.category !== undefined && { category: input.category }),
          ...(input.authoritative_url !== undefined && {
            authoritative_url: input.authoritative_url,
          }),
          ...(input.is_active !== undefined && { is_active: input.is_active }),
        },
      });
      if (input.translations) {
        await writeProgramTranslations(ctx.db, input.id, input.translations);
        await refreshProgramSearchVector(ctx.db, input.id);
      }
      return { id: input.id };
    }),

  setActive: publicProcedure
    .input(z.object({ id: z.string().uuid(), is_active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.programs.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Program not found" });
      }
      return ctx.db.programs.update({
        where: { id: input.id },
        data: { is_active: input.is_active },
        select: { id: true, is_active: true },
      });
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
