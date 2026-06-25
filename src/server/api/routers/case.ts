import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { recordAudit } from "~/server/api/helpers/audit";
import { notifyCaseworkerMessage } from "~/server/api/helpers/notify";
import { assertSessionAccess, requireRole } from "~/server/api/helpers/session";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { priorityFromAnswers } from "~/server/lib/case-priority";

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
        contact_name: z.string().trim().min(1).max(200).optional(),
        contact_email: z.string().trim().email().max(254).optional(),
        contact_phone: z.string().trim().min(1).max(64).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contact = {
        ...(input.contact_name && { contact_name: input.contact_name }),
        ...(input.contact_email && { contact_email: input.contact_email }),
        ...(input.contact_phone && { contact_phone: input.contact_phone }),
      };
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
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found",
          });
        }
      } else {
        // Resident self-service: enforces ownership / anonymous access.
        await assertSessionAccess(ctx, input.session_id);
      }

      const existing = await ctx.db.cases.findFirst({
        where: {
          session_id: input.session_id,
          status: { in: [...OPEN_STATUSES] },
        },
        orderBy: { created_at: "desc" },
      });
      if (existing) {
        // Attach the resident's message and fill in any contact info they
        // provided this time, on the case they already have open.
        if (Object.keys(contact).length > 0) {
          await ctx.db.cases.update({
            where: { id: existing.id },
            data: { ...contact, updated_at: new Date() },
          });
          Object.assign(existing, contact);
        }
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

      // Auto-triage from the screening answers unless a priority was passed
      // in explicitly (a staff member opening the case can override).
      let priorityData: {
        priority?: "low" | "normal" | "high" | "urgent";
        priority_reason?: string | null;
      } = {};
      if (input.priority) {
        priorityData = { priority: input.priority };
      } else {
        const answers = await ctx.db.screening_answers.findMany({
          where: { session_id: input.session_id },
          select: {
            answer_value: true,
            questions: { select: { question_key: true } },
          },
        });
        const byKey: Record<string, unknown> = {};
        for (const a of answers)
          byKey[a.questions.question_key] = a.answer_value;
        const auto = priorityFromAnswers(byKey);
        priorityData = {
          priority: auto.priority,
          priority_reason: auto.reason,
        };
      }

      const created = await ctx.db.cases.create({
        data: {
          session_id: input.session_id,
          status: "new",
          source: "screening",
          ...priorityData,
          ...contact,
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

  /**
   * Resident-facing caseworker conversation. Returns the signed-in resident's
   * most recent case (across their sessions) plus the shared, non-internal
   * messages — internal staff notes are never exposed. `null` when the resident
   * has no case yet.
   */
  myThread: publicProcedure.query(async ({ ctx }) => {
    const appUserId = ctx.session?.user.appUserId;
    if (!appUserId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Sign in to view your messages",
      });
    }
    const kase = await ctx.db.cases.findFirst({
      where: { screening_sessions: { user_id: appUserId } },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        status: true,
        users: {
          select: { email: true, auth_user: { select: { name: true } } },
        },
        case_notes: {
          where: { is_internal: false },
          orderBy: { created_at: "asc" },
          select: { id: true, note: true, author_id: true, created_at: true },
        },
      },
    });
    if (!kase) return null;
    return {
      case_id: kase.id,
      status: kase.status,
      caseworker_name: kase.users?.auth_user?.name ?? kase.users?.email ?? null,
      messages: kase.case_notes.map((n) => ({
        id: n.id,
        note: n.note,
        created_at: n.created_at,
        // Resident messages are author-null (legacy "request help") or authored
        // by the resident themselves; everything else is the caseworker.
        from:
          n.author_id === null || n.author_id === appUserId
            ? ("resident" as const)
            : ("caseworker" as const),
      })),
    };
  }),

  /**
   * Resident posts a message to their caseworker. Appended as a non-internal
   * case note (so it shows in both the resident thread and the staff queue) and
   * bumps the case so it resurfaces for the caseworker.
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        case_id: z.string().uuid(),
        message: z.string().trim().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appUserId = ctx.session?.user.appUserId;
      if (!appUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Sign in to send a message",
        });
      }
      const kase = await ctx.db.cases.findUnique({
        where: { id: input.case_id },
        select: { id: true, screening_sessions: { select: { user_id: true } } },
      });
      if (!kase || kase.screening_sessions?.user_id !== appUserId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      const note = await ctx.db.case_notes.create({
        data: {
          case_id: input.case_id,
          author_id: appUserId,
          note: input.message,
          is_internal: false,
        },
      });
      await ctx.db.cases.update({
        where: { id: input.case_id },
        data: { updated_at: new Date() },
      });
      return { id: note.id };
    }),

  /**
   * Staff message center: the caseworker's assigned conversations. One entry
   * per assigned, session-linked case, with the resident's name, the latest
   * resident-visible message, and whether it's awaiting a reply. Sorted so the
   * most recently active conversation is first.
   */
  staffThreads: publicProcedure.query(async ({ ctx }) => {
    const staff = await requireRole(ctx, [...STAFF]);
    const cases = await ctx.db.cases.findMany({
      where: { assigned_to: staff.id, session_id: { not: null } },
      orderBy: { updated_at: "desc" },
      select: {
        id: true,
        status: true,
        contact_name: true,
        screening_sessions: {
          select: {
            user_id: true,
            users: {
              select: { email: true, auth_user: { select: { name: true } } },
            },
          },
        },
        case_notes: {
          where: { is_internal: false },
          orderBy: { created_at: "desc" },
          take: 1,
          select: { note: true, created_at: true, author_id: true },
        },
      },
    });
    return cases.map((c) => {
      const residentUserId = c.screening_sessions?.user_id ?? null;
      const last = c.case_notes[0] ?? null;
      const fromResident =
        last != null &&
        (last.author_id === residentUserId || last.author_id === null);
      return {
        case_id: c.id,
        status: c.status,
        resident_name:
          c.contact_name ??
          c.screening_sessions?.users?.auth_user?.name ??
          c.screening_sessions?.users?.email ??
          "Resident",
        last_message: last
          ? {
              preview:
                last.note.length > 100
                  ? `${last.note.slice(0, 97)}…`
                  : last.note,
              created_at: last.created_at,
              from: fromResident ? ("resident" as const) : ("staff" as const),
            }
          : null,
        // No read-state model — surface the actionable heuristic instead: the
        // resident spoke last, so a reply is owed.
        awaiting_reply: fromResident,
      };
    });
  }),

  /** Staff message center: the full resident-visible thread for one case. */
  staffThread: publicProcedure
    .input(z.object({ case_id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const staff = await requireRole(ctx, [...STAFF]);
      const c = await ctx.db.cases.findUnique({
        where: { id: input.case_id },
        select: {
          id: true,
          status: true,
          assigned_to: true,
          contact_name: true,
          screening_sessions: {
            select: {
              user_id: true,
              users: {
                select: { email: true, auth_user: { select: { name: true } } },
              },
            },
          },
          case_notes: {
            where: { is_internal: false },
            orderBy: { created_at: "asc" },
            select: { id: true, note: true, author_id: true, created_at: true },
          },
        },
      });
      if (!c) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      // Caseworkers see only their own assigned conversations; admins see any.
      if (staff.role !== "admin" && c.assigned_to !== staff.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your case" });
      }
      const residentUserId = c.screening_sessions?.user_id ?? null;
      return {
        case_id: c.id,
        status: c.status,
        resident_name:
          c.contact_name ??
          c.screening_sessions?.users?.auth_user?.name ??
          c.screening_sessions?.users?.email ??
          "Resident",
        messages: c.case_notes.map((n) => ({
          id: n.id,
          note: n.note,
          created_at: n.created_at,
          from:
            n.author_id === residentUserId || n.author_id === null
              ? ("resident" as const)
              : ("staff" as const),
        })),
      };
    }),

  list: publicProcedure
    .input(
      z
        .object({
          status: statusSchema.optional(),
          priority: prioritySchema.optional(),
          assigned_to: z.string().optional(), // uuid | "me" | "unassigned"
          // Where the request came from: a completed screening ("Request help"),
          // the chat assistant handoff, or an uploaded document that needs
          // manual review.
          source: z
            .enum(["screening", "chatbot", "document_review"])
            .optional(),
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
        ...(input.source && { source: input.source }),
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
              referrals: {
                orderBy: { created_at: "desc" },
                include: { organizations: true },
              },
              // The case's documents, joined through its session, so staff can
              // review uploads (and their validation verdicts) in context —
              // especially the `document_review`-sourced cases the validator
              // opens. SSNs are already redacted into validation_reason upstream.
              document_uploads: {
                where: { status: { not: "deleted" } },
                orderBy: { created_at: "desc" },
                select: {
                  id: true,
                  file_name: true,
                  validation_status: true,
                  validation_reason: true,
                  created_at: true,
                  document_types: {
                    select: {
                      doc_key: true,
                      document_type_translations: {
                        where: { language_code: "en" },
                        select: { name: true },
                        take: 1,
                      },
                    },
                  },
                },
              },
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
      // Read-access audit: a staff member opened a resident's full case record
      // (contact PII + notes). Captures who/when/IP so PII access is traceable
      // for breach investigations — write actions are audited separately. The
      // polled thread/queue endpoints are intentionally NOT logged per-tick, to
      // avoid flooding the audit table; add session-windowed logging there if
      // message-view auditing is later required.
      await recordAudit(ctx, {
        action: "case.view",
        entity_type: "case",
        entity_id: input.id,
      });
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
        select: { id: true, session_id: true },
      });
      if (!exists) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
      }
      const updated = await ctx.db.cases.update({
        where: { id: input.id },
        data: {
          ...(input.status && { status: input.status }),
          // A manual priority change supersedes the auto-triage reason.
          ...(input.priority && {
            priority: input.priority,
            priority_reason: null,
          }),
          ...(input.assigned_to !== undefined && {
            assigned_to: input.assigned_to,
          }),
          updated_at: new Date(),
        },
      });
      // Resolving or closing a case closes its outstanding referrals — the work
      // is done, so they shouldn't linger as draft/sent/accepted.
      if (
        (input.status === "resolved" || input.status === "closed") &&
        exists.session_id
      ) {
        await ctx.db.referrals.updateMany({
          where: { session_id: exists.session_id, status: { not: "closed" } },
          data: { status: "closed" },
        });
      }
      await recordAudit(ctx, {
        action: "case.update",
        entity_type: "case",
        entity_id: input.id,
        after: {
          ...(input.status && { status: input.status }),
          ...(input.priority && { priority: input.priority }),
          ...(input.assigned_to !== undefined && {
            assigned_to: input.assigned_to,
          }),
        },
      });
      return updated;
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
      const assigned = await ctx.db.cases.update({
        where: { id: input.id },
        data: { assigned_to: input.assigned_to, updated_at: new Date() },
      });
      await recordAudit(ctx, {
        action: "case.assign",
        entity_type: "case",
        entity_id: input.id,
        after: { assigned_to: input.assigned_to },
      });
      return assigned;
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
      const created = await ctx.db.case_notes.create({
        data: {
          case_id: input.case_id,
          author_id: staff.id,
          note: input.note,
          is_internal: input.is_internal,
        },
      });
      // A resident-visible note is a message to the resident — notify them.
      // Best-effort so a notification hiccup never fails the note.
      if (!input.is_internal) {
        await notifyCaseworkerMessage(ctx.db, input.case_id, input.note).catch(
          () => null,
        );
      }
      return created;
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
