import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { assertSessionAccess, requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/**
 * Caseworker dashboard (Story 18). Reads/writes are role-gated to
 * caseworker/admin (a caseworker may only read a case assigned to them; admins
 * see everything) — except `create`, which residents can also call to request
 * help on their own screening session.
 */

const STAFF = ["caseworker", "admin"] as const;

const statusSchema = z.enum([
  "new",
  "in_progress",
  "waiting_on_client",
  "resolved",
  "closed",
]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

// Statuses that count as an active case (used for idempotency on create).
const OPEN_STATUSES = ["new", "in_progress", "waiting_on_client"] as const;

export const caseRouter = createTRPCRouter({
  /**
   * Open a case for a screening session. Two callers:
   *   - a resident requesting help (must have access to the session), or
   *   - staff opening a case for any session.
   * Idempotent: if an open case already exists for the session it's returned
   * (`created: false`) rather than spawning a duplicate, so a resident tapping
   * "request help" twice never floods the queue.
   */
  create: publicProcedure
    .input(
      z.object({
        session_id: z.string().uuid(),
        priority: prioritySchema.optional(),
        message: z.string().trim().min(1).max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appUserId = ctx.session?.user.appUserId ?? null;
      const role = appUserId
        ? (
            await ctx.db.users.findUnique({
              where: { id: appUserId },
              select: { role: true },
            })
          )?.role
        : null;
      const isStaff = role === "caseworker" || role === "admin";

      if (isStaff) {
        const session = await ctx.db.screening_sessions.findUnique({
          where: { id: input.session_id },
          select: { id: true },
        });
        if (!session) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
        }
      } else {
        // Resident self-service: enforces ownership / anonymous access.
        await assertSessionAccess(ctx, input.session_id);
      }

      const existing = await ctx.db.cases.findFirst({
        where: { session_id: input.session_id, status: { in: [...OPEN_STATUSES] } },
        orderBy: { created_at: "desc" },
      });
      if (existing) {
        // Attach the resident's message to the case they already have open.
        if (input.message) {
          await ctx.db.case_notes.create({
            data: {
              case_id: existing.id,
              author_id: isStaff ? appUserId : null,
              note: input.message,
              is_internal: isStaff,
            },
          });
        }
        return { ...existing, created: false };
      }

      const created = await ctx.db.cases.create({
        data: {
          session_id: input.session_id,
          status: "new",
          ...(input.priority && { priority: input.priority }),
        },
      });

      if (input.message) {
        await ctx.db.case_notes.create({
          data: {
            case_id: created.id,
            author_id: isStaff ? appUserId : null,
            note: input.message,
            // A resident's message is client-facing context, not an internal note.
            is_internal: isStaff,
          },
        });
      }

      return { ...created, created: true };
    }),

  list: publicProcedure
    .input(
      z
        .object({
          status: statusSchema.optional(),
          priority: prioritySchema.optional(),
          assigned_to: z.string().optional(), // uuid | "me" | "unassigned"
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);

      let assignedFilter: object = {};
      if (input.assigned_to === "me") {
        assignedFilter = { assigned_to: staff.id };
      } else if (input.assigned_to === "unassigned") {
        assignedFilter = { assigned_to: null };
      } else if (input.assigned_to) {
        assignedFilter = { assigned_to: input.assigned_to };
      }

      const where = {
        ...(input.status && { status: input.status }),
        ...(input.priority && { priority: input.priority }),
        ...assignedFilter,
      };

      const [total, data] = await Promise.all([
        ctx.db.cases.count({ where }),
        ctx.db.cases.findMany({
          where,
          orderBy: [{ priority: "desc" }, { created_at: "desc" }],
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
      ]);

      return {
        data,
        meta: {
          page: input.page,
          limit: input.limit,
          total,
          total_pages: Math.ceil(total / input.limit),
        },
      };
    }),

  byId: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);
      const found = await ctx.db.cases.findUnique({
        where: { id: input.id },
        include: {
          case_notes: { orderBy: { created_at: "desc" } },
          screening_sessions: {
            select: {
              id: true,
              preferred_language: true,
              completed_at: true,
              current_step: true,
            },
          },
        },
      });
      if (!found) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      if (staff.role !== "admin" && found.assigned_to !== staff.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Case is assigned to another caseworker",
        });
      }
      return found;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: statusSchema.optional(),
        priority: prioritySchema.optional(),
        assigned_to: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const exists = await ctx.db.cases.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      return ctx.db.cases.update({
        where: { id: input.id },
        data: {
          ...(input.status && { status: input.status }),
          ...(input.priority && { priority: input.priority }),
          ...(input.assigned_to !== undefined && {
            assigned_to: input.assigned_to,
          }),
          updated_at: new Date(),
        },
      });
    }),

  assign: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assigned_to: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const exists = await ctx.db.cases.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      return ctx.db.cases.update({
        where: { id: input.id },
        data: { assigned_to: input.assigned_to, updated_at: new Date() },
      });
    }),
});

export const caseNoteRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ case_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireRole(ctx, [...STAFF]);
      const data = await ctx.db.case_notes.findMany({
        where: { case_id: input.case_id },
        orderBy: { created_at: "desc" },
      });
      return { data };
    }),

  create: publicProcedure
    .input(
      z.object({
        case_id: z.string().uuid(),
        note: z.string().trim().min(1).max(5000),
        is_internal: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);
      const caseRow = await ctx.db.cases.findUnique({
        where: { id: input.case_id },
        select: { id: true },
      });
      if (!caseRow) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      return ctx.db.case_notes.create({
        data: {
          case_id: input.case_id,
          author_id: staff.id,
          note: input.note,
          is_internal: input.is_internal,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string().trim().min(1).max(5000).optional(),
        is_internal: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);
      const existing = await ctx.db.case_notes.findUnique({
        where: { id: input.id },
        select: { id: true, author_id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }
      if (staff.role !== "admin" && existing.author_id !== staff.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author or an admin can edit this note",
        });
      }
      return ctx.db.case_notes.update({
        where: { id: input.id },
        data: {
          ...(input.note !== undefined && { note: input.note }),
          ...(input.is_internal !== undefined && {
            is_internal: input.is_internal,
          }),
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);
      const existing = await ctx.db.case_notes.findUnique({
        where: { id: input.id },
        select: { id: true, author_id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }
      if (staff.role !== "admin" && existing.author_id !== staff.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the author or an admin can delete this note",
        });
      }
      await ctx.db.case_notes.delete({ where: { id: input.id } });
      return { id: input.id, deleted: true };
    }),
});
