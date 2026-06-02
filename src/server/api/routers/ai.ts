import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  embedText,
  explainEligibility,
  generateGroundedAnswer,
  isAiEnabled,
  type ChatTurn,
  type Citation,
  type EligibilityExplanation,
  type RetrievedPassage,
} from "../../../../lib/ai-service";
import { assertSessionAccess } from "~/server/api/helpers/session";
import { priorityFromAnswers } from "~/server/lib/case-priority";
import {
  aiProcedure,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { type createTRPCContext } from "~/server/api/trpc";

type Ctx = Awaited<ReturnType<typeof createTRPCContext>>;

/** How many knowledge-base passages to ground an answer on. */
const KB_TOP_K = 4;

/**
 * AI navigator (Story 13). The model integration is stubbed — these
 * procedures persist the conversation/message records and return a
 * deterministic, safe answer. Wiring the real LLM call is a separate task;
 * the contract (shape, citations, handoff) is implemented here.
 *
 * Story 13 acceptance criteria honored by the stub:
 *  - plain-language Q&A with source citations
 *  - never makes an official eligibility decision (disclaimer always appended)
 *  - human escalation offered
 */

const langSchema = z.string().min(2).max(8).default("en");

const DISCLAIMER: Record<string, string> = {
  en: "This is general information, not an official eligibility decision. Final determinations are made by the administering agency.",
  es: "Esta es información general, no una decisión oficial de elegibilidad. Las determinaciones finales las realiza la agencia administradora.",
};

function disclaimerFor(lang: string) {
  return DISCLAIMER[lang] ?? DISCLAIMER.en!;
}

/** Deterministic, safe fallback used when AI is unavailable or unable to ground an answer. */
function buildAnswer(question: string, lang: string): {
  answer: string;
  citations: Citation[];
} {
  return {
    answer: `Thanks for your question: "${question}". ${disclaimerFor(lang)}`,
    citations: [
      {
        title: "Benefits.gov — Eligibility Basics",
        url: "https://www.benefits.gov/",
        source_id: null,
      },
    ],
  };
}

/**
 * Retrieve the top-k vetted knowledge-base passages for a question via
 * pgvector similarity. Returns `[]` (so the caller falls back to the
 * deterministic answer) when AI is disabled or the KB is not yet indexed —
 * the latter check also avoids spending an embedding call on an empty corpus.
 */
async function retrieveKnowledge(
  ctx: Ctx,
  question: string,
  lang: string,
): Promise<RetrievedPassage[]> {
  if (!isAiEnabled()) return [];

  const indexed = await ctx.db.search_embeddings.count({
    where: { target_type: "knowledge_source", language_code: lang },
  });
  if (indexed === 0) return [];

  const queryVec = await embedText(question);
  if (!queryVec) return [];
  const literal = `[${queryVec.join(",")}]`;

  return ctx.db.$queryRaw<RetrievedPassage[]>`
    SELECT ks.id::text                  AS source_id,
           ks.title                     AS title,
           ks.source_url                AS url,
           COALESCE(ks.content_text, '') AS content
    FROM search_embeddings se
    JOIN knowledge_sources ks ON ks.id = se.target_id
    WHERE se.target_type = 'knowledge_source'
      AND se.language_code = ${lang}
    ORDER BY se.embedding <=> ${literal}::vector
    LIMIT ${KB_TOP_K}
  `;
}

/**
 * Produce an answer for a user message: RAG-grounded via the model when the
 * knowledge base supports it, otherwise the deterministic safe fallback. The
 * policy disclaimer is always appended.
 */
async function answerQuestion(
  ctx: Ctx,
  question: string,
  lang: string,
  history: ChatTurn[] = [],
): Promise<{ answer: string; citations: Citation[] }> {
  const passages = await retrieveKnowledge(ctx, question, lang);
  if (passages.length > 0) {
    const generated = await generateGroundedAnswer({
      question,
      passages,
      language_code: lang,
      history,
    });
    if (generated?.grounded) {
      return {
        answer: `${generated.answer}\n\n${disclaimerFor(lang)}`,
        citations: generated.citations,
      };
    }
  }
  // AI disabled, KB unindexed, or the model refused for lack of grounding.
  return buildAnswer(question, lang);
}

/**
 * Ownership for a conversation: a user-owned conversation must match the
 * caller's appUserId; a session-owned one defers to `assertSessionAccess`.
 */
async function assertConversationAccess(ctx: Ctx, conversationId: string) {
  const convo = await ctx.db.ai_conversations.findUnique({
    where: { id: conversationId },
    select: { id: true, user_id: true, session_id: true, language_code: true },
  });
  if (!convo) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });
  }
  if (convo.user_id !== null) {
    if (convo.user_id !== ctx.session?.user.appUserId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Conversation belongs to another user",
      });
    }
  } else if (convo.session_id) {
    await assertSessionAccess(ctx, convo.session_id);
  }
  return convo;
}

/** Human-readable labels for the deterministic outcome enum (English base). */
const OUTCOME_LABELS: Record<string, string> = {
  likely_eligible: "Likely eligible",
  may_be_eligible: "May be eligible",
  unlikely_eligible: "Unlikely eligible",
  needs_more_info: "Needs more information",
};

/** Pull the `reasons` string array out of the rules engine's explanation JSON. */
export function extractReasons(explanation: unknown): string[] {
  if (
    explanation &&
    typeof explanation === "object" &&
    "reasons" in explanation
  ) {
    const { reasons } = explanation;
    if (Array.isArray(reasons)) {
      return reasons.filter((r): r is string => typeof r === "string");
    }
  }
  return [];
}

/**
 * Deterministic, non-AI explanation. Always available, used as the fallback
 * when the model is disabled, times out, or errors — so the explainer endpoint
 * never fails to return something useful. Exported for testing.
 */
export function buildFallbackExplanation(
  outcome: string,
  programName: string,
  reasons: string[],
): EligibilityExplanation {
  const label = (OUTCOME_LABELS[outcome] ?? outcome).toLowerCase();
  const explanation =
    `Based on your screening answers, you are ${label} for ${programName}. ` +
    `This is an estimate from your responses, not an official decision — the agency that runs ${programName} makes the final determination.`;
  return {
    explanation,
    key_factors: reasons,
    next_steps: [
      `Review the eligibility details for ${programName}.`,
      "Gather the documents on your checklist before applying.",
      "Open the official application to confirm and apply.",
    ],
  };
}

export const aiRouter = createTRPCRouter({
  /** One-shot stateless ask: creates a conversation + first exchange. */
  ask: aiProcedure
    .input(
      z.object({
        session_id: z.string().uuid().optional(),
        question: z.string().trim().min(1).max(2000),
        language_code: langSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.session_id) {
        await assertSessionAccess(ctx, input.session_id);
      }
      const { answer, citations } = await answerQuestion(
        ctx,
        input.question,
        input.language_code,
      );

      const conversation = await ctx.db.ai_conversations.create({
        data: {
          session_id: input.session_id ?? null,
          user_id: ctx.session?.user.appUserId ?? null,
          language_code: input.language_code,
          ai_messages: {
            create: [
              { role: "user", content: input.question },
              { role: "assistant", content: answer, citations },
            ],
          },
        },
        select: { id: true },
      });

      return {
        conversation_id: conversation.id,
        answer,
        citations,
        human_handoff_offered: true,
      };
    }),

  createConversation: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid().optional(),
        language_code: langSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.session_id) {
        await assertSessionAccess(ctx, input.session_id);
      }
      return ctx.db.ai_conversations.create({
        data: {
          session_id: input.session_id ?? null,
          user_id: ctx.session?.user.appUserId ?? null,
          language_code: input.language_code,
        },
      });
    }),

  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const appUserId = ctx.session.user.appUserId;
    if (!appUserId) return { data: [] };
    const data = await ctx.db.ai_conversations.findMany({
      where: { user_id: appUserId },
      orderBy: { created_at: "desc" },
    });
    return { data };
  }),

  byId: publicProcedure
    .input(z.object({ conversation_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertConversationAccess(ctx, input.conversation_id);
      const convo = await ctx.db.ai_conversations.findUnique({
        where: { id: input.conversation_id },
        include: {
          ai_messages: { orderBy: { created_at: "asc" } },
        },
      });
      return convo;
    }),

  sendMessage: aiProcedure
    .input(
      z.object({
        conversation_id: z.string().uuid(),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const convo = await assertConversationAccess(ctx, input.conversation_id);
      const lang = convo.language_code ?? "en";

      // Prior turns give the model conversational context for follow-ups.
      const prior = await ctx.db.ai_messages.findMany({
        where: { conversation_id: input.conversation_id },
        orderBy: { created_at: "asc" },
        select: { role: true, content: true },
      });
      const history: ChatTurn[] = prior
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as ChatTurn["role"], content: m.content }));

      const { answer, citations } = await answerQuestion(
        ctx,
        input.content,
        lang,
        history,
      );

      await ctx.db.ai_messages.create({
        data: {
          conversation_id: input.conversation_id,
          role: "user",
          content: input.content,
        },
      });
      const reply = await ctx.db.ai_messages.create({
        data: {
          conversation_id: input.conversation_id,
          role: "assistant",
          content: answer,
          citations,
        },
      });
      return reply;
    }),

  handoff: publicProcedure
    .input(
      z.object({
        conversation_id: z.string().uuid(),
        contact_name: z.string().trim().min(1).max(200).optional(),
        contact_email: z.string().trim().email().max(254).optional(),
        contact_phone: z.string().trim().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const convo = await assertConversationAccess(ctx, input.conversation_id);
      // Spec §1.9.2 HANDOFF_ALREADY_REQUESTED — idempotency guard (runs before
      // we create a case, so a double-tap can't enqueue two cases).
      const current = await ctx.db.ai_conversations.findUnique({
        where: { id: convo.id },
        select: { human_handoff_requested: true },
      });
      if (current?.human_handoff_requested) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Human handoff already requested",
        });
      }

      // Auto-triage from the linked screening session, if the chat had one.
      let priority: "low" | "normal" | "high" | "urgent" = "normal";
      let priority_reason: string | null = null;
      if (convo.session_id) {
        const answers = await ctx.db.screening_answers.findMany({
          where: { session_id: convo.session_id },
          select: {
            answer_value: true,
            questions: { select: { question_key: true } },
          },
        });
        const byKey: Record<string, unknown> = {};
        for (const a of answers) byKey[a.questions.question_key] = a.answer_value;
        const auto = priorityFromAnswers(byKey);
        priority = auto.priority;
        priority_reason = auto.reason;
      }

      // The resident's most recent question, for caseworker context.
      const lastUserMsg = await ctx.db.ai_messages.findFirst({
        where: { conversation_id: convo.id, role: "user" },
        orderBy: { created_at: "desc" },
        select: { content: true },
      });

      // Land the request in the caseworker Cases queue + flag the conversation,
      // atomically.
      const [, updated] = await ctx.db.$transaction([
        ctx.db.cases.create({
          data: {
            session_id: convo.session_id,
            conversation_id: convo.id,
            status: "new",
            priority,
            priority_reason,
            ...(input.contact_name && { contact_name: input.contact_name }),
            ...(input.contact_email && { contact_email: input.contact_email }),
            ...(input.contact_phone && { contact_phone: input.contact_phone }),
            case_notes: {
              create: {
                note: lastUserMsg?.content
                  ? `Requested a caseworker from the chat assistant. Most recent question: "${lastUserMsg.content}"`
                  : "Requested a caseworker from the chat assistant.",
                is_internal: false,
              },
            },
          },
        }),
        ctx.db.ai_conversations.update({
          where: { id: convo.id },
          data: { human_handoff_requested: true },
        }),
      ]);
      return updated;
    }),

  /**
   * Plain-language explanation of an eligibility result (eligibility explainer).
   * The deterministic rules engine owns the `outcome`; this only rephrases it.
   * Rate-limited (aiProcedure) and always returns a usable payload — when AI is
   * unavailable or fails it falls back to `buildFallbackExplanation`, flagged by
   * `ai_generated: false`.
   */
  explainEligibility: aiProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        program_id: z.string().uuid(),
        language_code: langSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);

      const result = await ctx.db.eligibility_results.findUnique({
        where: {
          session_id_program_id: {
            session_id: input.session_id,
            program_id: input.program_id,
          },
        },
        select: {
          outcome: true,
          explanation: true,
          programs: {
            select: {
              program_key: true,
              program_translations: {
                where: { language_code: input.language_code },
                select: { name: true },
                take: 1,
              },
            },
          },
        },
      });
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No eligibility result for this program in this session",
        });
      }

      const programName =
        result.programs.program_translations[0]?.name ??
        result.programs.program_key;
      const reasons = extractReasons(result.explanation);

      const ai = await explainEligibility({
        program_name: programName,
        outcome: result.outcome,
        outcome_label: OUTCOME_LABELS[result.outcome] ?? result.outcome,
        reasons,
        language_code: input.language_code,
      });

      const payload =
        ai ?? buildFallbackExplanation(result.outcome, programName, reasons);

      return {
        outcome: result.outcome,
        outcome_label: OUTCOME_LABELS[result.outcome] ?? result.outcome,
        program_name: programName,
        ...payload,
        ai_generated: ai !== null,
        disclaimer: disclaimerFor(input.language_code),
      };
    }),
});
