import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type Prisma, type PrismaClient } from "../../../../generated/prisma";
import { assertSessionAccess, requireRole } from "~/server/api/helpers/session";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  buildFacts,
  evaluateProgram,
  OUTCOME_WEIGHT,
  parseProgramRules,
  type ProgramEvaluation,
} from "~/server/lib/eligibility";

/**
 * Screening core router.
 *
 * Anonymous sessions are intentional: Story 1 requires that residents can
 * start a screening without an account. The session id functions as a bearer
 * token for anonymous (user_id IS NULL) sessions. Once a session is claimed
 * by an account (user_id IS NOT NULL), ownership is enforced by
 * `assertSessionAccess` so only the owning user can read or mutate it.
 */

const SESSION_TTL_DAYS = 30;
const ttl = () =>
  new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

export const screeningSessionRouter = createTRPCRouter({
  create: publicProcedure
    .input(
      z
        .object({
          preferred_language: z.string().min(2).max(8).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.screening_sessions.create({
        data: {
          user_id: ctx.session?.user.appUserId ?? null,
          preferred_language: input?.preferred_language ?? "en",
          current_step: 0,
          expires_at: ttl(),
        },
        select: {
          id: true,
          preferred_language: true,
          current_step: true,
          created_at: true,
          expires_at: true,
        },
      });
      return session;
    }),

  /**
   * The signed-in user's own screening sessions, newest first, with a small
   * summary (answer + result counts and a completed flag) for the resident
   * dashboard's history list.
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const appUserId = ctx.session.user.appUserId;
    if (!appUserId) return [];
    return ctx.db.screening_sessions.findMany({
      where: { user_id: appUserId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        preferred_language: true,
        current_step: true,
        completed_at: true,
        expires_at: true,
        created_at: true,
        _count: {
          select: { screening_answers: true, eligibility_results: true },
        },
      },
    });
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.id);
      const session = await ctx.db.screening_sessions.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          user_id: true,
          preferred_language: true,
          current_step: true,
          completed_at: true,
          expires_at: true,
          created_at: true,
          screening_answers: {
            select: {
              question_id: true,
              answer_value: true,
              updated_at: true,
            },
          },
        },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
      return session;
    }),
});

// ---- Admin question authoring (Story: admin catalog management) -----------
// The questionnaire UI can only render these answer types, so authoring is
// constrained to them.
const ANSWER_TYPES = [
  "integer",
  "decimal",
  "boolean",
  "single_select",
  "text",
] as const;

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits, and underscores only");

const promptSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  helper_text: z.string().trim().max(500).nullish(),
});
const promptsSchema = z.object({
  en: promptSchema,
  es: promptSchema.optional(),
});
const optionInputSchema = z.object({
  option_key: keySchema,
  en: z.string().trim().min(1).max(200),
  es: z.string().trim().min(1).max(200),
});

async function writeQuestionTranslations(
  db: PrismaClient,
  questionId: string,
  prompts: z.infer<typeof promptsSchema>,
) {
  for (const [language_code, t] of Object.entries(prompts)) {
    if (!t) continue;
    await db.question_translations.upsert({
      where: { question_id_language_code: { question_id: questionId, language_code } },
      update: { prompt: t.prompt, helper_text: t.helper_text ?? null },
      create: {
        question_id: questionId,
        language_code,
        prompt: t.prompt,
        helper_text: t.helper_text ?? null,
      },
    });
  }
}

async function writeQuestionOptions(
  db: PrismaClient,
  questionId: string,
  options: z.infer<typeof optionInputSchema>[],
) {
  for (let i = 0; i < options.length; i++) {
    const opt = options[i]!;
    const option = await db.answer_options.upsert({
      where: {
        question_id_option_key: { question_id: questionId, option_key: opt.option_key },
      },
      update: { display_order: i, value: opt.option_key },
      create: {
        question_id: questionId,
        option_key: opt.option_key,
        value: opt.option_key,
        display_order: i,
      },
    });
    for (const language_code of ["en", "es"] as const) {
      await db.answer_option_translations.upsert({
        where: { option_id_language_code: { option_id: option.id, language_code } },
        update: { label: opt[language_code] },
        create: { option_id: option.id, language_code, label: opt[language_code] },
      });
    }
  }
  // Drop options no longer present (translations cascade on delete).
  await db.answer_options.deleteMany({
    where: { question_id: questionId, option_key: { notIn: options.map((o) => o.option_key) } },
  });
}

export const questionRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          language_code: z.string().min(2).max(8).default("en"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const lang = input?.language_code ?? "en";
      const questions = await ctx.db.questions.findMany({
        orderBy: { display_order: "asc" },
        select: {
          id: true,
          question_key: true,
          answer_type: true,
          display_order: true,
          is_required: true,
          branching_config: true,
          question_translations: {
            where: { language_code: lang },
            select: { prompt: true, helper_text: true },
            take: 1,
          },
          answer_options: {
            orderBy: { display_order: "asc" },
            select: {
              id: true,
              option_key: true,
              value: true,
              display_order: true,
              answer_option_translations: {
                where: { language_code: lang },
                select: { label: true },
                take: 1,
              },
            },
          },
        },
      });

      // Flatten the translation joins into the response shape so the client
      // doesn't have to dig through the nested take:1 arrays.
      return questions.map((q) => ({
        id: q.id,
        question_key: q.question_key,
        answer_type: q.answer_type,
        display_order: q.display_order,
        is_required: q.is_required,
        branching_config: q.branching_config,
        prompt: q.question_translations[0]?.prompt ?? q.question_key,
        helper_text: q.question_translations[0]?.helper_text ?? null,
        options: q.answer_options.map((o) => ({
          id: o.id,
          option_key: o.option_key,
          value: o.value,
          display_order: o.display_order,
          label: o.answer_option_translations[0]?.label ?? o.option_key,
        })),
      }));
    }),

  create: publicProcedure
    .input(
      z.object({
        question_key: keySchema,
        answer_type: z.enum(ANSWER_TYPES),
        display_order: z.number().int().min(0),
        is_required: z.boolean().default(true),
        prompts: promptsSchema,
        options: z.array(optionInputSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      if (input.answer_type === "single_select" && (input.options?.length ?? 0) < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "single_select questions need at least two options",
        });
      }
      const dup = await ctx.db.questions.findUnique({
        where: { question_key: input.question_key },
        select: { id: true },
      });
      if (dup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A question with key "${input.question_key}" already exists`,
        });
      }
      const question = await ctx.db.questions.create({
        data: {
          question_key: input.question_key,
          answer_type: input.answer_type,
          display_order: input.display_order,
          is_required: input.is_required,
        },
        select: { id: true },
      });
      await writeQuestionTranslations(ctx.db, question.id, input.prompts);
      if (input.options) await writeQuestionOptions(ctx.db, question.id, input.options);
      return { id: question.id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        answer_type: z.enum(ANSWER_TYPES).optional(),
        display_order: z.number().int().min(0).optional(),
        is_required: z.boolean().optional(),
        prompts: promptsSchema.optional(),
        options: z.array(optionInputSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.questions.findUnique({
        where: { id: input.id },
        select: { id: true, answer_type: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
      }
      const nextType = input.answer_type ?? existing.answer_type;
      if (input.options && nextType === "single_select" && input.options.length < 2) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "single_select questions need at least two options",
        });
      }
      await ctx.db.questions.update({
        where: { id: input.id },
        data: {
          ...(input.answer_type !== undefined && { answer_type: input.answer_type }),
          ...(input.display_order !== undefined && { display_order: input.display_order }),
          ...(input.is_required !== undefined && { is_required: input.is_required }),
        },
      });
      if (input.prompts) await writeQuestionTranslations(ctx.db, input.id, input.prompts);
      if (input.options) await writeQuestionOptions(ctx.db, input.id, input.options);
      return { id: input.id };
    }),
});

export const answerRouter = createTRPCRouter({
  upsert: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        question_id: z.string().uuid(),
        answer_value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const session = await assertSessionAccess(ctx, input.session_id);
      if (session.expires_at && session.expires_at < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session has expired",
        });
      }

      const answer = await ctx.db.screening_answers.upsert({
        where: {
          session_id_question_id: {
            session_id: input.session_id,
            question_id: input.question_id,
          },
        },
        update: {
          answer_value: input.answer_value as object,
          updated_at: new Date(),
        },
        create: {
          session_id: input.session_id,
          question_id: input.question_id,
          answer_value: input.answer_value as object,
        },
      });
      return answer;
    }),
});

export const eligibilityRouter = createTRPCRouter({
  run: publicProcedure
    .input(z.object({ session_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);

      // Derive the fact set once from this session's answers (keyed by
      // question_key, the stable identifier the rules reference).
      const answers = await ctx.db.screening_answers.findMany({
        where: { session_id: input.session_id },
        select: {
          answer_value: true,
          questions: { select: { question_key: true } },
        },
      });
      const answersByKey: Record<string, unknown> = {};
      for (const a of answers) {
        answersByKey[a.questions.question_key] = a.answer_value;
      }
      const facts = buildFacts(answersByKey);

      // Pull the latest rule version per active program.
      const programs = await ctx.db.programs.findMany({
        where: { is_active: true },
        select: {
          id: true,
          eligibility_rule_versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, rules_json: true, false_positive_bias: true },
          },
        },
      });

      // Evaluate each program against the rules stored in its latest version.
      // A rule version whose JSON isn't in the rule format (legacy placeholder,
      // malformed admin draft) degrades to `needs_more_info` rather than
      // throwing or silently passing.
      const evaluations = programs
        .filter((p) => p.eligibility_rule_versions[0])
        .map((p) => {
          const rv = p.eligibility_rule_versions[0]!;
          const rules = parseProgramRules(rv.rules_json);
          const evaluation: ProgramEvaluation = rules
            ? evaluateProgram(rules, facts, rv.false_positive_bias)
            : {
                outcome: "needs_more_info",
                reasons: [
                  "Initial screening only — final determination requires application.",
                ],
                criteria: [],
              };
          return { programId: p.id, ruleVersionId: rv.id, evaluation };
        });

      // Best-matched programs first (likely → may_be → needs_more_info →
      // unlikely), so `priority_rank` drives a useful results ordering.
      evaluations.sort(
        (a, b) =>
          OUTCOME_WEIGHT[a.evaluation.outcome] -
          OUTCOME_WEIGHT[b.evaluation.outcome],
      );

      const results = await Promise.all(
        evaluations.map((e, i) => {
          const explanation = {
            reasons: e.evaluation.reasons,
            criteria: e.evaluation.criteria,
          } as unknown as Prisma.InputJsonValue;
          return ctx.db.eligibility_results.upsert({
            where: {
              session_id_program_id: {
                session_id: input.session_id,
                program_id: e.programId,
              },
            },
            update: {
              outcome: e.evaluation.outcome,
              priority_rank: i,
              rule_version_id: e.ruleVersionId,
              explanation,
            },
            create: {
              session_id: input.session_id,
              program_id: e.programId,
              rule_version_id: e.ruleVersionId,
              outcome: e.evaluation.outcome,
              priority_rank: i,
              explanation,
            },
          });
        }),
      );

      return { count: results.length };
    }),
});

export const eligibilityResultRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        language_code: z.string().min(2).max(8).default("en"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const results = await ctx.db.eligibility_results.findMany({
        where: { session_id: input.session_id },
        orderBy: { priority_rank: "asc" },
        select: {
          id: true,
          outcome: true,
          priority_rank: true,
          explanation: true,
          created_at: true,
          programs: {
            select: {
              id: true,
              program_key: true,
              category: true,
              authoritative_url: true,
              program_translations: {
                where: { language_code: input.language_code },
                select: { name: true, short_description: true, next_steps: true },
                take: 1,
              },
            },
          },
        },
      });

      return results.map((r) => ({
        id: r.id,
        outcome: r.outcome,
        priority_rank: r.priority_rank,
        explanation: r.explanation,
        created_at: r.created_at,
        program: {
          id: r.programs.id,
          program_key: r.programs.program_key,
          category: r.programs.category,
          authoritative_url: r.programs.authoritative_url,
          name: r.programs.program_translations[0]?.name ?? r.programs.program_key,
          short_description:
            r.programs.program_translations[0]?.short_description ?? null,
          next_steps: r.programs.program_translations[0]?.next_steps ?? null,
        },
      }));
    }),
});
