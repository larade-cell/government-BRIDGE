import { TRPCError } from "@trpc/server";
import { z } from "zod";

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

export const documentChecklistRouter = createTRPCRouter({
  bySession: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        language_code: langSchema,
        program_id: z.string().uuid().optional(),
        status: z.enum(["missing", "uploaded", "verified"]).optional(),
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
            classified_by: true,
          },
        }),
      ]);

      // Derive per-document-type upload status. A user-confirmed type counts
      // as "verified"; any other non-deleted upload counts as "uploaded".
      const statusByType = new Map<string, "uploaded" | "verified">();
      for (const u of uploads) {
        if (!u.document_type_id) continue;
        const current = statusByType.get(u.document_type_id);
        const next = u.classified_by === "user" ? "verified" : "uploaded";
        if (current !== "verified") statusByType.set(u.document_type_id, next);
      }

      const data = items.map((item) => {
        const upload_status =
          statusByType.get(item.document_type_id) ?? "missing";
        const t = item.document_types.document_type_translations[0];
        return {
          id: item.id,
          session_id: item.session_id,
          program_id: item.program_id,
          reason: item.reason,
          created_at: item.created_at,
          upload_status,
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

      const results = await ctx.db.eligibility_results.findMany({
        where: { session_id: input.session_id },
        select: {
          program_id: true,
          programs: {
            select: {
              program_document_requirements: {
                where: { is_required: true },
                select: { document_type_id: true, condition_json: true },
              },
            },
          },
        },
      });

      const rows = results.flatMap((r) =>
        r.programs.program_document_requirements.map((req) => ({
          session_id: input.session_id,
          program_id: r.program_id,
          document_type_id: req.document_type_id,
        })),
      );

      const written = await Promise.all(
        rows.map((row) =>
          ctx.db.session_document_checklist.upsert({
            where: {
              session_id_program_id_document_type_id: row,
            },
            update: {},
            create: row,
          }),
        ),
      );

      return { count: written.length };
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
      if (session.completed_at) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is already completed",
        });
      }
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
          file_name: input.file_name,
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
