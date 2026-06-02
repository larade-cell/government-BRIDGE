import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type PrismaClient } from "../../../../generated/prisma";
import {
  EMBEDDING_MODEL,
  embedText,
  isAiEnabled,
} from "../../../../lib/ai-service";
import { recordAudit } from "~/server/api/helpers/audit";
import { requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Knowledge-source management for the eligibility chatbot's RAG (admin-only).
 * Creating/updating a source (re-)embeds it into `search_embeddings` so the
 * chatbot can retrieve and cite it; deleting removes both the source and its
 * vector. Embedding is best-effort: if AI is disabled (no OPENAI_API_KEY) the
 * source is still saved, just not retrievable until embeddings are generated
 * (e.g. via `npm run backfill:embeddings`).
 */

const langSchema = z.string().min(2).max(8);

/** Combined text we embed + store as the retrievable passage. */
function passageText(title: string, content: string): string {
  return [title, content]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
}

/** (Re)write the embedding for a knowledge source. Returns whether it embedded. */
async function embedSource(
  db: PrismaClient,
  args: { id: string; title: string; content: string; language_code: string },
): Promise<boolean> {
  if (!isAiEnabled()) return false;
  const text = passageText(args.title, args.content);
  if (!text) return false;
  const vector = await embedText(text);
  if (!vector) return false;
  const literal = `[${vector.join(",")}]`;
  await db.$executeRaw`
    INSERT INTO search_embeddings
      (target_type, target_id, language_code, content_text, embedding, embedding_model)
    VALUES (
      'knowledge_source'::search_target_type,
      ${args.id}::uuid,
      ${args.language_code},
      ${text},
      ${literal}::vector,
      ${EMBEDDING_MODEL}
    )
    ON CONFLICT (target_type, target_id, language_code, embedding_model)
    DO UPDATE SET
      content_text = EXCLUDED.content_text,
      embedding    = EXCLUDED.embedding,
      created_at   = now()
  `;
  return true;
}

/** Drop every embedding for a knowledge source (any language/model). */
function deleteSourceEmbeddings(db: PrismaClient, id: string) {
  return db.$executeRaw`
    DELETE FROM search_embeddings
    WHERE target_type = 'knowledge_source'::search_target_type
      AND target_id = ${id}::uuid
  `;
}

export const knowledgeRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ language_code: langSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const rows = await ctx.db.knowledge_sources.findMany({
        where: input?.language_code
          ? { language_code: input.language_code }
          : undefined,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          title: true,
          source_url: true,
          language_code: true,
          content_text: true,
          program_id: true,
          created_at: true,
        },
      });
      // Flag which sources currently have an embedding (i.e. are retrievable).
      const embedded = await ctx.db.search_embeddings.findMany({
        where: {
          target_type: "knowledge_source",
          target_id: { in: rows.map((r) => r.id) },
        },
        select: { target_id: true },
      });
      const embeddedIds = new Set(embedded.map((e) => e.target_id));
      return rows.map((r) => ({ ...r, embedded: embeddedIds.has(r.id) }));
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(300),
        source_url: z.string().url().max(500),
        language_code: langSchema.default("en"),
        content_text: z.string().trim().min(1).max(20000),
        program_id: z.string().uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const created = await ctx.db.knowledge_sources.create({
        data: {
          title: input.title,
          source_url: input.source_url,
          language_code: input.language_code,
          content_text: input.content_text,
          program_id: input.program_id ?? null,
        },
        select: { id: true },
      });
      const embedded = await embedSource(ctx.db, {
        id: created.id,
        title: input.title,
        content: input.content_text,
        language_code: input.language_code,
      });
      await recordAudit(ctx, {
        action: "knowledge.create",
        entity_type: "knowledge_source",
        entity_id: created.id,
        after: { title: input.title, language_code: input.language_code },
      });
      return { id: created.id, embedded };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(300).optional(),
        source_url: z.string().url().max(500).optional(),
        language_code: langSchema.optional(),
        content_text: z.string().trim().min(1).max(20000).optional(),
        program_id: z.string().uuid().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.knowledge_sources.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge source not found" });
      }
      const updated = await ctx.db.knowledge_sources.update({
        where: { id: input.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.source_url !== undefined && { source_url: input.source_url }),
          ...(input.language_code !== undefined && {
            language_code: input.language_code,
          }),
          ...(input.content_text !== undefined && {
            content_text: input.content_text,
          }),
          ...(input.program_id !== undefined && {
            program_id: input.program_id,
          }),
        },
        select: { id: true, title: true, content_text: true, language_code: true },
      });
      // Re-embed from the new content. Drop old vectors first in case the
      // language changed (the row's language_code is part of the embedding key).
      await deleteSourceEmbeddings(ctx.db, input.id);
      const embedded = await embedSource(ctx.db, {
        id: updated.id,
        title: updated.title,
        content: updated.content_text ?? "",
        language_code: updated.language_code ?? "en",
      });
      await recordAudit(ctx, {
        action: "knowledge.update",
        entity_type: "knowledge_source",
        entity_id: updated.id,
      });
      return { id: updated.id, embedded };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, ["admin"]);
      const existing = await ctx.db.knowledge_sources.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge source not found" });
      }
      // search_embeddings has no FK to knowledge_sources, so clear it explicitly.
      await ctx.db.$transaction([
        deleteSourceEmbeddings(ctx.db, input.id),
        ctx.db.knowledge_sources.delete({ where: { id: input.id } }),
      ]);
      await recordAudit(ctx, {
        action: "knowledge.delete",
        entity_type: "knowledge_source",
        entity_id: input.id,
      });
      return { id: input.id, deleted: true };
    }),
});
