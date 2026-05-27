import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

/**
 * Screening core router.
 *
 * Anonymous sessions are intentional: Story 1 requires that residents can
 * start a screening without an account. The session id functions as a bearer
 * token — anyone presenting a valid id can act on that session. When/if a
 * `user_id` is later attached, additional authorization checks should kick in.
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
          user_id: ctx.session?.user.id ?? null,
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
      // Confirm the session exists and isn't expired.
      const session = await ctx.db.screening_sessions.findUnique({
        where: { id: input.session_id },
        select: { id: true, expires_at: true, completed_at: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }
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
      const session = await ctx.db.screening_sessions.findUnique({
        where: { id: input.session_id },
        select: { id: true },
      });
      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Pull the latest rule version per active program.
      const programs = await ctx.db.programs.findMany({
        where: { is_active: true },
        select: {
          id: true,
          eligibility_rule_versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true },
          },
        },
      });

      // Placeholder logic: every program with a rule version gets
      // `may_be_eligible`. Real rule evaluation comes with the rule-engine
      // story.
      const results = await Promise.all(
        programs
          .filter((p) => p.eligibility_rule_versions[0])
          .map((p, i) =>
            ctx.db.eligibility_results.upsert({
              where: {
                session_id_program_id: {
                  session_id: input.session_id,
                  program_id: p.id,
                },
              },
              update: {
                outcome: "may_be_eligible",
                priority_rank: i,
                rule_version_id: p.eligibility_rule_versions[0]!.id,
                explanation: {
                  reasons: ["Initial screening only — final determination requires application."],
                },
              },
              create: {
                session_id: input.session_id,
                program_id: p.id,
                rule_version_id: p.eligibility_rule_versions[0]!.id,
                outcome: "may_be_eligible",
                priority_rank: i,
                explanation: {
                  reasons: ["Initial screening only — final determination requires application."],
                },
              },
            }),
          ),
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
