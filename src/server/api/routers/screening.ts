import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type Prisma } from "../../../../generated/prisma";
import { assertSessionAccess } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
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
