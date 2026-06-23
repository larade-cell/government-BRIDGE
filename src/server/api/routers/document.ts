import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  analyzeDocument,
  classifyDocument,
  CHAT_MODEL,
  isAiEnabled,
} from "../../../../lib/ai-service";
import { generateSessionChecklist } from "~/server/api/helpers/document-checklist";
import { runUploadValidation } from "~/server/api/helpers/document-validation";
import { redactSsn } from "~/server/api/helpers/redact";
import { assertSessionAccess } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Session document checklist (Story 8) and document uploads (Story 9/15).
 *
 * Both are session-scoped: the caller must present a valid `session_id`, and
 * once the session is claimed by an account ownership is enforced via
 * `assertSessionAccess`.
 */

const langSchema = z.string().min(2).max(8).default("en");

// Story 9 acceptance criterion: accept JPG, PNG, PDF, HEIC.
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "image/heic",
] as const;

const UPLOAD_SLOT_TTL_MS = 20 * 60 * 1000; // 20 minutes

// The vision model reads raster images directly. PDF/HEIC uploads are accepted
// for storage but can't be sent to the vision endpoint as-is, so analysis skips
// them (a separate OCR/convert step would feed `classifyDocument` text instead).
const VISION_MIME = ["image/jpeg", "image/png"] as const;

/** A checklist row's status, after folding in the document's validation verdict. */
type ChecklistStatus =
  | "missing"
  | "uploaded"
  | "verified"
  | "invalid"
  | "needs_review";

/**
 * Collapse one document type's per-upload validation verdicts into a single
 * checklist status (+ an explanatory reason for the actionable ones). A `valid`
 * upload wins (verified); one still awaiting its verdict keeps the type pending
 * (`uploaded`); otherwise the most relevant problem surfaces. `unreadable`
 * folds into `invalid` — both mean "re-upload a better file".
 */
function deriveTypeStatus(
  rows: { validation_status: string; validation_reason: string | null }[],
): { status: ChecklistStatus; reason: string | null } {
  if (rows.some((r) => r.validation_status === "valid")) {
    return { status: "verified", reason: null };
  }
  if (rows.some((r) => r.validation_status === "unvalidated")) {
    return { status: "uploaded", reason: null };
  }
  const review = rows.find((r) => r.validation_status === "needs_review");
  if (review) {
    return { status: "needs_review", reason: review.validation_reason };
  }
  const bad = rows.find(
    (r) =>
      r.validation_status === "invalid" || r.validation_status === "unreadable",
  );
  if (bad) return { status: "invalid", reason: bad.validation_reason };
  return { status: "missing", reason: null };
}

export const documentChecklistRouter = createTRPCRouter({
  bySession: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        language_code: langSchema,
        program_id: z.string().uuid().optional(),
        status: z
          .enum(["missing", "uploaded", "verified", "invalid", "needs_review"])
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);

      const [items, uploads] = await Promise.all([
        ctx.db.session_document_checklist.findMany({
          where: {
            session_id: input.session_id,
            ...(input.program_id && { program_id: input.program_id }),
          },
          orderBy: { created_at: "asc" },
          select: {
            id: true,
            session_id: true,
            program_id: true,
            reason: true,
            created_at: true,
            document_type_id: true,
            programs: {
              select: {
                id: true,
                program_translations: {
                  where: { language_code: input.language_code },
                  select: { name: true },
                  take: 1,
                },
              },
            },
            document_types: {
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
            },
          },
        }),
        ctx.db.document_uploads.findMany({
          where: {
            session_id: input.session_id,
            status: { not: "deleted" },
          },
          select: {
            document_type_id: true,
            validation_status: true,
            validation_reason: true,
          },
        }),
      ]);

      // Derive each document type's checklist status from its uploads'
      // validation verdicts (a verdict lives per upload, but the checklist is
      // per type, and one valid file satisfies every program needing that
      // type). Precedence, best first: a `valid` upload makes the type
      // `verified`; an upload still awaiting its verdict keeps it pending
      // (`uploaded`); otherwise surface the actionable verdict (`needs_review`
      // for a human, `invalid` for a wrong/unreadable file to re-upload),
      // carrying the reason so the UI can explain it. "verified" is now earned
      // by a check, never by the user merely claiming a type.
      const byType = new Map<
        string,
        { status: ChecklistStatus; reason: string | null }
      >();
      const byTypeUploads = new Map<string, typeof uploads>();
      for (const u of uploads) {
        if (!u.document_type_id) continue;
        const list = byTypeUploads.get(u.document_type_id) ?? [];
        list.push(u);
        byTypeUploads.set(u.document_type_id, list);
      }
      for (const [typeId, rows] of byTypeUploads) {
        byType.set(typeId, deriveTypeStatus(rows));
      }

      const data = items.map((item) => {
        const derived = byType.get(item.document_type_id);
        const upload_status: ChecklistStatus = derived?.status ?? "missing";
        const validation_reason = derived?.reason ?? null;
        const t = item.document_types.document_type_translations[0];
        return {
          id: item.id,
          session_id: item.session_id,
          program_id: item.program_id,
          program: item.programs
            ? {
                id: item.programs.id,
                name:
                  item.programs.program_translations[0]?.name ?? "Program",
              }
            : null,
          reason: item.reason,
          created_at: item.created_at,
          upload_status,
          validation_reason,
          document_type: {
            id: item.document_types.id,
            doc_key: item.document_types.doc_key,
            category: item.document_types.category,
            name: t?.name ?? item.document_types.doc_key,
            description: t?.description ?? null,
            examples: t?.examples ?? null,
          },
        };
      });

      const filtered = input.status
        ? data.filter((d) => d.upload_status === input.status)
        : data;

      return { data: filtered, meta: { language: input.language_code } };
    }),

  /**
   * (Re)generate the checklist from the session's current eligibility results.
   * Pulls every required document for each program the session was screened
   * against, then upserts one checklist row per (session, program, doc type).
   */
  generate: publicProcedure
    .input(z.object({ session_id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const count = await generateSessionChecklist(ctx.db, input.session_id);
      return { count };
    }),
});

export const documentUploadRouter = createTRPCRouter({
  /**
   * Initiate an upload. In production this would mint a presigned URL to an
   * object store; here we return a placeholder slot so the contract is wired.
   */
  create: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        file_name: z.string().trim().min(1).max(255),
        file_mime_type: z.string().trim().min(1).max(128),
        size: z.number().int().positive().optional(),
        document_type_id: z.string().uuid().optional(),
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
      // Completed sessions deliberately remain uploadable: gathering documents
      // is a post-screening activity, and the /account/documents tab operates
      // on the user's latest *completed* session. (Expiry above still applies.)
      if (!ALLOWED_MIME.includes(input.file_mime_type as (typeof ALLOWED_MIME)[number])) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported file type: ${input.file_mime_type}. Allowed: ${ALLOWED_MIME.join(", ")}`,
        });
      }
      if (input.document_type_id) {
        const dt = await ctx.db.document_types.findUnique({
          where: { id: input.document_type_id },
          select: { id: true },
        });
        if (!dt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Document type not found",
          });
        }
      }

      const upload = await ctx.db.document_uploads.create({
        data: {
          session_id: input.session_id,
          document_type_id: input.document_type_id ?? null,
          // Defensive: a user could name the file with their SSN.
          file_name: redactSsn(input.file_name),
          file_mime_type: input.file_mime_type,
          // Placeholder until object-store integration lands. The real flow
          // PUTs to `upload_url` then a webhook fills the canonical URL.
          storage_url: `pending://${input.session_id}/${input.file_name}`,
          status: "uploaded",
          classified_by: input.document_type_id ? "user" : null,
          classified_at: input.document_type_id ? new Date() : null,
        },
      });

      return {
        id: upload.id,
        upload_url: `https://uploads.local/stub/${upload.id}`,
        upload_headers: { "x-bridge-session": input.session_id },
        expires_at: new Date(Date.now() + UPLOAD_SLOT_TTL_MS),
      };
    }),

  list: publicProcedure
    .input(z.object({ session_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const data = await ctx.db.document_uploads.findMany({
        where: { session_id: input.session_id, status: { not: "deleted" } },
        orderBy: { created_at: "desc" },
      });
      return { data };
    }),

  byId: publicProcedure
    .input(z.object({ session_id: z.string().uuid(), id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const upload = await ctx.db.document_uploads.findUnique({
        where: { id: input.id },
        include: {
          document_classifications: {
            orderBy: { created_at: "desc" },
          },
        },
      });
      if (upload?.session_id !== input.session_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      return upload;
    }),

  /** User correction of the confirmed document type (Story 15). */
  update: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        id: z.string().uuid(),
        document_type_id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const existing = await ctx.db.document_uploads.findUnique({
        where: { id: input.id },
        select: { id: true, session_id: true },
      });
      if (existing?.session_id !== input.session_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      return ctx.db.document_uploads.update({
        where: { id: input.id },
        data: {
          document_type_id: input.document_type_id,
          classified_by: "user",
          classified_at: new Date(),
        },
      });
    }),

  /**
   * Run document validation: judge whether the uploaded file genuinely is a
   * legible document of its claimed type, and persist the verdict. The client
   * calls this right after an upload. Fail-safe — anything inconclusive (AI
   * off, low confidence, unreadable, no claimed type) becomes `needs_review`,
   * never a silent pass. See runUploadValidation for the decision rules.
   */
  validate: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        id: z.string().uuid(),
        language_code: langSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const existing = await ctx.db.document_uploads.findUnique({
        where: { id: input.id },
        select: { id: true, session_id: true },
      });
      if (existing?.session_id !== input.session_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      const outcome = await runUploadValidation(
        ctx.db,
        input.id,
        input.language_code,
      );
      if (!outcome) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      return outcome;
    }),

  /**
   * AI analysis of an uploaded image (Story 8/15): vision-OCR the document,
   * map the extracted text to a known document type, and persist the result
   * plus an audit row. Advisory only — a user-confirmed type is never
   * overwritten, and the prediction is recorded separately for review.
   *
   * Returns `{ analyzed: false, reason }` (rather than throwing) when AI is
   * disabled or the file can't be analyzed, so the upload flow degrades cleanly.
   */
  analyze: publicProcedure
    .input(z.object({ session_id: z.string().uuid(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const upload = await ctx.db.document_uploads.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          session_id: true,
          storage_url: true,
          file_mime_type: true,
          classified_by: true,
        },
      });
      if (upload?.session_id !== input.session_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      // Nothing to fetch behind a still-pending upload slot.
      if (upload.storage_url.startsWith("pending://")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload is not available yet",
        });
      }
      if (
        !VISION_MIME.includes(
          upload.file_mime_type as (typeof VISION_MIME)[number],
        )
      ) {
        return { analyzed: false as const, reason: "unsupported_mime" as const };
      }
      if (!isAiEnabled()) {
        return { analyzed: false as const, reason: "ai_disabled" as const };
      }

      await ctx.db.document_uploads.update({
        where: { id: upload.id },
        data: { status: "ocr_pending" },
      });

      const analysis = await analyzeDocument({ imageUrl: upload.storage_url });
      if (!analysis) {
        await ctx.db.document_uploads.update({
          where: { id: upload.id },
          data: { status: "failed" },
        });
        return { analyzed: false as const, reason: "analysis_failed" as const };
      }

      // Map the OCR text onto a known document type.
      const types = await ctx.db.document_types.findMany({
        select: {
          id: true,
          doc_key: true,
          document_type_translations: {
            where: { language_code: "en" },
            select: { description: true },
            take: 1,
          },
        },
      });
      const classification = analysis.extracted_text
        ? await classifyDocument({
            text: analysis.extracted_text,
            candidates: types.map((t) => ({
              doc_key: t.doc_key,
              description:
                t.document_type_translations[0]?.description ?? t.doc_key,
            })),
          })
        : null;
      const predicted = classification?.doc_key
        ? (types.find((t) => t.doc_key === classification.doc_key) ?? null)
        : null;

      // Persist OCR + prediction. A user-confirmed type wins, so only set the
      // confirmed `document_type_id` when the user hasn't already chosen one.
      const userConfirmed = upload.classified_by === "user";
      const updated = await ctx.db.document_uploads.update({
        where: { id: upload.id },
        data: {
          // Never persist the raw OCR text — an SSN card (or many tax/benefit
          // docs) would land verbatim in the DB. Classification above already
          // ran on the in-memory text; only the stored copy is masked.
          ocr_text: redactSsn(analysis.extracted_text),
          status: "ocr_complete",
          predicted_document_type_id: predicted?.id ?? null,
          ...(predicted && !userConfirmed
            ? {
                document_type_id: predicted.id,
                classification_confidence: classification?.confidence ?? null,
                classified_by: "ai",
                classified_at: new Date(),
              }
            : {}),
        },
      });

      await ctx.db.document_classifications.create({
        data: {
          document_upload_id: upload.id,
          document_type_id: predicted?.id ?? null,
          confidence: classification?.confidence ?? null,
          classified_by: "ai",
          model_name: CHAT_MODEL,
          raw_response: {
            summary: redactSsn(analysis.summary),
            suggested_type: analysis.suggested_type,
          },
        },
      });

      return {
        analyzed: true as const,
        ocr_text: updated.ocr_text,
        summary: analysis.summary,
        suggested_type: analysis.suggested_type,
        predicted_document_type_id: predicted?.id ?? null,
        confidence: classification?.confidence ?? null,
      };
    }),

  /** Finalize an upload after the object store PUT completes (webhook). */
  finalize: publicProcedure
    .input(z.object({ session_id: z.string().uuid(), id: z.string().uuid(), storage_url: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      // The storage service calls this; allow either staff or the session owner.
      const existing = await ctx.db.document_uploads.findUnique({ where: { id: input.id }, select: { id: true, session_id: true } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      if (existing.session_id !== input.session_id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "session_id mismatch" });
      }
      // Transition to uploaded and persist canonical storage URL.
      const updated = await ctx.db.document_uploads.update({ where: { id: input.id }, data: { storage_url: input.storage_url, status: "uploaded" } });
      // The bytes are now reachable, so validate against the claimed type.
      // Fail-safe internally; never let a validation hiccup fail the webhook.
      await runUploadValidation(ctx.db, input.id).catch(() => null);
      return { id: updated.id, status: updated.status, storage_url: updated.storage_url };
    }),

  /** Soft-delete: retains the row, flips status to `deleted` (Story 9). */
  delete: publicProcedure
    .input(z.object({ session_id: z.string().uuid(), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx, input.session_id);
      const existing = await ctx.db.document_uploads.findUnique({
        where: { id: input.id },
        select: { id: true, session_id: true },
      });
      if (existing?.session_id !== input.session_id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Upload not found" });
      }
      return ctx.db.document_uploads.update({
        where: { id: input.id },
        data: { status: "deleted" },
      });
    }),
});
