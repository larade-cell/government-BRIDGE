import { randomUUID } from "node:crypto";

import type { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `~/server/auth` pulls in NextAuth (and `next/server`), which Vitest's node
// resolver can't load. The caller builds its session manually and never calls
// `auth()`, so a stub is sufficient.
vi.mock("~/server/auth", () => ({ auth: () => Promise.resolve(null) }));

import {
  buildFallbackExplanation,
  extractReasons,
} from "~/server/api/routers/ai";
import {
  checkRateLimit,
  checkRateLimitPg,
} from "~/server/api/helpers/rate-limit";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";

/**
 * API tests exercised through the tRPC caller against the local Postgres.
 * They cover positive paths and the negative cases the spec promises
 * (ownership, expiry, validation, role-gating, state conflicts).
 *
 * Fixtures are created in `beforeAll` with random keys and removed in
 * `afterAll`, so the suite is safe to run repeatedly against the dev DB.
 */

type Caller = ReturnType<typeof createCaller>;

function caller(appUserId: string | null): Caller {
  const session: Session | null =
    appUserId === null
      ? null
      : {
          // `role` is carried in the session for UI gating; tRPC role checks
          // (requireRole) re-read it from the DB, so null is fine here.
          user: { id: randomUUID(), appUserId, role: null },
          expires: new Date(Date.now() + 3_600_000).toISOString(),
        };
  return createCaller({ db, session, headers: new Headers() });
}

async function expectCode(p: Promise<unknown>, code: TRPCError["code"]) {
  await expect(p).rejects.toMatchObject({ code });
}

// Shared fixtures
let programId: string;
let docTypeId: string;
let caseworkerId: string;
let adminId: string;
let residentId: string;
let tempProgramId: string;

const createdSessionIds: string[] = [];
const createdConversationIds: string[] = [];
const createdUserIds: string[] = [];

beforeAll(async () => {
  // A seeded, active program that has at least one rule version (so
  // eligibility.run produces a result for it).
  const program = await db.programs.findFirst({
    where: { is_active: true, eligibility_rule_versions: { some: {} } },
    select: { id: true },
  });
  if (!program) throw new Error("Seed a program with a rule version first");
  programId = program.id;

  const docType = await db.document_types.findFirst({ select: { id: true } });
  if (!docType) throw new Error("Seed at least one document_type first");
  docTypeId = docType.id;

  // Document requirement so checklist.generate has something to emit.
  await db.program_document_requirements.upsert({
    where: {
      program_id_document_type_id: {
        program_id: programId,
        document_type_id: docTypeId,
      },
    },
    update: { is_required: true },
    create: {
      program_id: programId,
      document_type_id: docTypeId,
      is_required: true,
    },
  });

  // Role fixtures.
  const mkUser = async (role: "resident" | "caseworker" | "admin") => {
    const u = await db.users.create({
      data: { email: `test-${role}-${randomUUID()}@example.test`, role },
      select: { id: true },
    });
    createdUserIds.push(u.id);
    return u.id;
  };
  residentId = await mkUser("resident");
  caseworkerId = await mkUser("caseworker");
  adminId = await mkUser("admin");

  // Throwaway program for the rule-version publish test.
  const temp = await db.programs.create({
    data: {
      program_key: `temp-${randomUUID()}`,
      category: "test",
      authoritative_url: "https://example.test",
    },
    select: { id: true },
  });
  tempProgramId = temp.id;
});

afterAll(async () => {
  // Remove cases opened from test conversations (chatbot handoffs) before the
  // conversations go, so none are left orphaned in the shared dev DB.
  await db.cases.deleteMany({
    where: { conversation_id: { in: createdConversationIds } },
  });
  await db.ai_conversations.deleteMany({
    where: { id: { in: createdConversationIds } },
  });
  await db.screening_sessions.deleteMany({
    where: { id: { in: createdSessionIds } },
  });
  await db.program_document_requirements.deleteMany({
    where: { program_id: programId, document_type_id: docTypeId },
  });
  await db.programs.deleteMany({ where: { id: tempProgramId } });
  // Audit rows reference the actor user (FK NoAction), so clear them before
  // deleting the fixture users.
  await db.audit_logs.deleteMany({
    where: { actor_user_id: { in: createdUserIds } },
  });
  await db.users.deleteMany({ where: { id: { in: createdUserIds } } });
  await db.$disconnect();
});

async function newSession(appUserId: string | null = null) {
  const s = await caller(appUserId).screeningSession.create({});
  createdSessionIds.push(s.id);
  return s;
}

describe("Phase 1 — screening core", () => {
  it("runs the anonymous flow end to end", async () => {
    const anon = caller(null);
    const session = await newSession();

    const question = await db.questions.findFirst({ select: { id: true } });
    expect(question).toBeTruthy();

    const answer = await anon.answer.upsert({
      session_id: session.id,
      question_id: question!.id,
      answer_value: 4,
    });
    expect(answer.answer_value).toBe(4);

    const run = await anon.eligibility.run({ session_id: session.id });
    expect(run.count).toBeGreaterThanOrEqual(1);

    const results = await anon.eligibilityResult.list({
      session_id: session.id,
      language_code: "en",
    });
    expect(results.length).toBe(run.count);
    expect(results[0]).toHaveProperty("program");
  });

  it("enforces ownership once a session is claimed (FORBIDDEN)", async () => {
    const session = await newSession();
    await db.screening_sessions.update({
      where: { id: session.id },
      data: { user_id: residentId },
    });

    // Anonymous caller can no longer read it.
    await expectCode(caller(null).screeningSession.byId({ id: session.id }), "FORBIDDEN");
    // A different signed-in user can't either.
    await expectCode(caller(adminId).screeningSession.byId({ id: session.id }), "FORBIDDEN");
    // The owner can.
    const owned = await caller(residentId).screeningSession.byId({ id: session.id });
    expect(owned.id).toBe(session.id);
  });

  it("rejects answers on an expired session (BAD_REQUEST)", async () => {
    const session = await newSession();
    await db.screening_sessions.update({
      where: { id: session.id },
      data: { expires_at: new Date(Date.now() - 1000) },
    });
    const question = await db.questions.findFirst({ select: { id: true } });
    await expectCode(
      caller(null).answer.upsert({
        session_id: session.id,
        question_id: question!.id,
        answer_value: 1,
      }),
      "BAD_REQUEST",
    );
  });

  it("rejects a malformed session id (validation BAD_REQUEST)", async () => {
    const question = await db.questions.findFirst({ select: { id: true } });
    await expectCode(
      caller(null).answer.upsert({
        session_id: "not-a-uuid",
        question_id: question!.id,
        answer_value: 1,
      }),
      "BAD_REQUEST",
    );
  });

  it("returns NOT_FOUND for an unknown session", async () => {
    await expectCode(
      caller(null).screeningSession.byId({ id: randomUUID() }),
      "NOT_FOUND",
    );
  });

  it("lists questions ordered with translated prompts", async () => {
    const questions = await caller(null).question.list({ language_code: "en" });
    expect(questions.length).toBeGreaterThanOrEqual(1);
    expect(questions[0]).toHaveProperty("prompt");
    expect(questions[0]).toHaveProperty("options");
  });
});

describe("Phase 2 — programs, checklist, uploads", () => {
  it("lists programs with a pagination envelope", async () => {
    const res = await caller(null).program.list({ limit: 5 });
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.meta).toMatchObject({ page: 1, limit: 5 });
    expect(typeof res.meta.total).toBe("number");
  });

  it("gets a program by id and 404s on a missing one", async () => {
    const p = await caller(null).program.byId({ id: programId, language_code: "en" });
    expect(p.id).toBe(programId);
    await expectCode(caller(null).program.byId({ id: randomUUID(), language_code: "en" }), "NOT_FOUND");
  });

  it("search returns a ranked envelope (empty until indexed)", async () => {
    const res = await caller(null).program.search({ q: "food assistance", limit: 5 });
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.meta.query).toBe("food assistance");
  });

  it("rejects an empty search query (validation)", async () => {
    await expectCode(caller(null).program.search({ q: "" }), "BAD_REQUEST");
  });

  it("generates a checklist from eligibility results", async () => {
    const session = await newSession();
    await caller(null).eligibility.run({ session_id: session.id });
    const gen = await caller(null).documentChecklist.generate({ session_id: session.id });
    expect(gen.count).toBeGreaterThanOrEqual(1);

    const list = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });
    expect(list.data.length).toBeGreaterThanOrEqual(1);
    expect(list.data[0]?.upload_status).toBe("missing");
  });

  it("eligibility.run auto-populates the checklist (no manual refresh)", async () => {
    const session = await newSession();
    // Running eligibility alone must build the checklist — without a separate
    // documentChecklist.generate call — so required docs show up immediately.
    await caller(null).eligibility.run({ session_id: session.id });

    const list = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });
    expect(list.data.length).toBeGreaterThanOrEqual(1);
    expect(list.data.some((d) => d.document_type.id === docTypeId)).toBe(true);
    // Each program-scoped row carries its program for the grouped UI.
    const scoped = list.data.find((d) => d.program_id);
    expect(scoped?.program?.name).toEqual(expect.any(String));
  });

  it("a shared document upload updates every program that needs it", async () => {
    const session = await newSession();
    await caller(null).eligibility.run({ session_id: session.id });

    const before = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });

    // Find a document type required by two or more programs in this checklist.
    const programsByType = new Map<string, Set<string>>();
    for (const item of before.data) {
      if (!item.program) continue;
      const set = programsByType.get(item.document_type.id) ?? new Set();
      set.add(item.program.id);
      programsByType.set(item.document_type.id, set);
    }
    const sharedTypeId = [...programsByType.entries()].find(
      ([, progs]) => progs.size >= 2,
    )?.[0];
    expect(sharedTypeId).toBeTruthy();

    const rowsBefore = before.data.filter(
      (d) => d.document_type.id === sharedTypeId,
    );
    expect(rowsBefore.length).toBeGreaterThanOrEqual(2);
    expect(rowsBefore.every((d) => d.upload_status === "missing")).toBe(true);

    // Upload a single document of that shared type.
    await caller(null).documentUpload.create({
      session_id: session.id,
      file_name: "id.png",
      file_mime_type: "image/png",
      document_type_id: sharedTypeId!,
    });

    // One upload clears the requirement under every program that needed it.
    const after = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });
    const rowsAfter = after.data.filter(
      (d) => d.document_type.id === sharedTypeId,
    );
    expect(rowsAfter.length).toBe(rowsBefore.length);
    // Received, but NOT auto-"verified" — picking a type is an unchecked claim.
    expect(rowsAfter.every((d) => d.upload_status === "uploaded")).toBe(true);
    expect(new Set(rowsAfter.map((d) => d.program_id)).size).toBeGreaterThanOrEqual(2);
  });

  it("accepts a valid upload and rejects a bad mime type", async () => {
    const session = await newSession();
    const upload = await caller(null).documentUpload.create({
      session_id: session.id,
      file_name: "paystub.pdf",
      file_mime_type: "application/pdf",
    });
    expect(upload.id).toBeTruthy();
    expect(upload.upload_url).toContain(upload.id);

    await expectCode(
      caller(null).documentUpload.create({
        session_id: session.id,
        file_name: "virus.exe",
        file_mime_type: "application/x-msdownload",
      }),
      "BAD_REQUEST",
    );

    // Soft-delete removes it from the listing.
    await caller(null).documentUpload.delete({ session_id: session.id, id: upload.id });
    const list = await caller(null).documentUpload.list({ session_id: session.id });
    expect(list.data.find((u) => u.id === upload.id)).toBeUndefined();
  });

  it("allows uploads on a completed session (the documents tab)", async () => {
    const session = await newSession();
    // The /account/documents tab runs on the user's latest *completed* session,
    // so document collection must keep working after completion.
    await caller(null).screeningSession.complete({ session_id: session.id });
    const upload = await caller(null).documentUpload.create({
      session_id: session.id,
      file_name: "id.png",
      file_mime_type: "image/png",
    });
    expect(upload.id).toBeTruthy();
  });

  it("validates an upload and surfaces the verdict in the checklist", async () => {
    const session = await newSession();
    await caller(null).eligibility.run({ session_id: session.id });

    const upload = await caller(null).documentUpload.create({
      session_id: session.id,
      file_name: "id.png",
      file_mime_type: "image/png",
      document_type_id: docTypeId,
    });

    // Before validation runs, the document is received but only pending review —
    // never auto-"verified" just because the user picked a type.
    const before = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });
    expect(
      before.data.find((d) => d.document_type.id === docTypeId)?.upload_status,
    ).toBe("uploaded");

    // Validate. AI is disabled in tests, so the fail-safe routes to a human
    // (needs_review) rather than guessing valid/invalid.
    const verdict = await caller(null).documentUpload.validate({
      session_id: session.id,
      id: upload.id,
      language_code: "en",
    });
    expect(verdict.validation_status).toBe("needs_review");
    expect(verdict.validation_reason).toEqual(expect.any(String));

    // The checklist now reflects the verdict and carries its reason.
    const after = await caller(null).documentChecklist.bySession({
      session_id: session.id,
      language_code: "en",
    });
    const row = after.data.find((d) => d.document_type.id === docTypeId);
    expect(row?.upload_status).toBe("needs_review");
    expect(row?.upload_status).not.toBe("verified");
    expect(row?.validation_reason).toEqual(expect.any(String));
  });

  it("routes needs_review documents into one caseworker case", async () => {
    const session = await newSession();

    const mkUpload = () =>
      caller(null).documentUpload.create({
        session_id: session.id,
        file_name: "id.png",
        file_mime_type: "image/png",
        document_type_id: docTypeId,
      });

    // Two documents that both land in needs_review (AI is off in tests).
    const up1 = await mkUpload();
    await caller(null).documentUpload.validate({
      session_id: session.id,
      id: up1.id,
    });
    const up2 = await mkUpload();
    await caller(null).documentUpload.validate({
      session_id: session.id,
      id: up2.id,
    });

    // They share one open document_review case (idempotent — no queue flood),
    // each adding an internal note for the caseworker.
    const cases = await db.cases.findMany({
      where: { session_id: session.id },
      include: { case_notes: true },
    });
    expect(cases.length).toBe(1);
    expect(cases[0]?.source).toBe("document_review");
    expect(cases[0]?.status).toBe("new");
    expect(cases[0]!.case_notes.length).toBeGreaterThanOrEqual(2);
    expect(
      cases[0]!.case_notes.every((n) => n.is_internal),
    ).toBe(true);

    // And it surfaces in the staff queue filtered by the new source.
    const queued = await caller(adminId).case.list({ source: "document_review" });
    expect(queued.data.some((c) => c.id === cases[0]!.id)).toBe(true);
  });
});

describe("Phase 4 — AI, reports, cases, rule versions", () => {
  it("ai.ask creates a conversation and offers handoff once", async () => {
    const res = await caller(null).ai.ask({ question: "Do I qualify for SNAP?" });
    createdConversationIds.push(res.conversation_id);
    expect(res.answer).toContain("official eligibility decision");
    expect(res.human_handoff_offered).toBe(true);
    expect(res.citations.length).toBeGreaterThanOrEqual(1);

    await caller(null).ai.handoff({ conversation_id: res.conversation_id });
    // Second handoff is rejected.
    await expectCode(
      caller(null).ai.handoff({ conversation_id: res.conversation_id }),
      "BAD_REQUEST",
    );
  });

  it("reports are role-gated", async () => {
    await expectCode(caller(null).report.overview({}), "UNAUTHORIZED");
    await expectCode(caller(residentId).report.overview({}), "FORBIDDEN");
    const overview = await caller(caseworkerId).report.overview({});
    expect(typeof overview.total_sessions).toBe("number");
    expect(overview).toHaveProperty("completion_rate");
  });

  it("cases are role-gated", async () => {
    await expectCode(caller(residentId).case.list({}), "FORBIDDEN");
    const list = await caller(adminId).case.list({ limit: 5 });
    expect(Array.isArray(list.data)).toBe(true);
    expect(list.meta).toHaveProperty("total");
  });

  it("publishes a rule version and rejects double-publish (CONFLICT)", async () => {
    const admin = caller(adminId);
    const version = await admin.eligibilityRule.createVersion({
      program_id: tempProgramId,
      rules_json: { min_household_size: 1 },
    });
    expect(version.version).toBeGreaterThanOrEqual(1);

    const published = await admin.eligibilityRule.publish({ id: version.id });
    expect(published.is_published).toBe(true);

    await expectCode(admin.eligibilityRule.publish({ id: version.id }), "CONFLICT");
  });

  it("non-admins cannot create rule versions", async () => {
    await expectCode(
      caller(caseworkerId).eligibilityRule.createVersion({
        program_id: tempProgramId,
        rules_json: {},
      }),
      "FORBIDDEN",
    );
  });
});

describe("Citizen & admin views — dashboards", () => {
  it("screeningSession.listMine returns the caller's own sessions", async () => {
    await expectCode(caller(null).screeningSession.listMine(), "UNAUTHORIZED");
    const s = await newSession(residentId);
    const mine = await caller(residentId).screeningSession.listMine();
    expect(mine.some((x) => x.id === s.id)).toBe(true);
    expect(mine[0]).toHaveProperty("_count");
  });

  it("program create/update/setActive/adminList are admin-gated", async () => {
    const key = `test_prog_${randomUUID().slice(0, 8)}`;
    const translations = {
      en: { name: "Test", short_description: "desc", next_steps: "steps" },
    };
    await expectCode(caller(residentId).program.adminList(), "FORBIDDEN");
    await expectCode(
      caller(residentId).program.create({
        program_key: key,
        category: "test",
        authoritative_url: "https://example.test",
        translations,
      }),
      "FORBIDDEN",
    );

    const created = await caller(adminId).program.create({
      program_key: key,
      category: "test",
      authoritative_url: "https://example.test",
      translations,
    });
    expect(created.id).toBeTruthy();

    // Duplicate key is rejected.
    await expectCode(
      caller(adminId).program.create({
        program_key: key,
        category: "test",
        authoritative_url: "https://example.test",
        translations,
      }),
      "CONFLICT",
    );

    const toggled = await caller(adminId).program.setActive({
      id: created.id,
      is_active: false,
    });
    expect(toggled.is_active).toBe(false);

    const all = await caller(adminId).program.adminList();
    expect(all.some((p) => p.id === created.id)).toBe(true);

    await db.programs.delete({ where: { id: created.id } });
  });

  it("residents open a case from their session; create is idempotent", async () => {
    // Owned session: anonymous callers can't open a case on it.
    const owned = await newSession(residentId);
    await expectCode(
      caller(null).case.create({ session_id: owned.id }),
      "FORBIDDEN",
    );

    const first = await caller(residentId).case.create({
      session_id: owned.id,
      message: "Please help me apply.",
      contact_name: "Jordan Rivera",
      contact_email: "jordan@example.test",
      contact_phone: "555-0100",
    });
    expect(first.created).toBe(true);
    expect(first.contact_name).toBe("Jordan Rivera");
    expect(first.contact_email).toBe("jordan@example.test");

    // A second request reuses the open case instead of duplicating it.
    const second = await caller(residentId).case.create({
      session_id: owned.id,
    });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    // Caseworkers see who needs help + their contact details.
    const detail = await caller(adminId).case.byId({ id: first.id });
    expect(detail.contact_name).toBe("Jordan Rivera");
    expect(detail.contact_email).toBe("jordan@example.test");

    // It shows up in the staff queue.
    const queue = await caller(adminId).case.list({ limit: 100 });
    expect(queue.data.some((c) => c.id === first.id)).toBe(true);

    // Invalid contact email is rejected.
    await expectCode(
      caller(null).case.create({
        session_id: (await newSession(null)).id,
        contact_email: "not-an-email",
      }),
      "BAD_REQUEST",
    );

    // Anonymous sessions can self-serve too.
    const anonSession = await newSession(null);
    const anon = await caller(null).case.create({ session_id: anonSession.id });
    expect(anon.created).toBe(true);
  });

  it("auto-prioritizes a new case from the screening, overridable by staff", async () => {
    const session = await newSession(residentId);
    const housingQ = await db.questions.findUnique({
      where: { question_key: "housing_status" },
      select: { id: true },
    });
    await caller(residentId).answer.upsert({
      session_id: session.id,
      question_id: housingQ!.id,
      answer_value: "homeless",
    });

    const c = await caller(residentId).case.create({ session_id: session.id });
    expect(c.priority).toBe("urgent");
    expect(c.priority_reason).toMatch(/homeless/i);

    // A manual priority change supersedes the auto-triage reason.
    const updated = await caller(adminId).case.update({
      id: c.id,
      priority: "low",
    });
    expect(updated.priority).toBe("low");
    const detail = await caller(adminId).case.byId({ id: c.id });
    expect(detail.priority_reason).toBeNull();
  });

  it("chatbot handoff creates a case in the caseworker queue with contact", async () => {
    // createConversation has no model call, so this stays deterministic.
    const convo = await caller(null).ai.createConversation({ language_code: "en" });
    createdConversationIds.push(convo.id);

    await caller(null).ai.handoff({
      conversation_id: convo.id,
      contact_name: "Sam Diaz",
      contact_email: "sam@example.test",
    });

    const queue = await caller(adminId).case.list({ limit: 100 });
    const c = queue.data.find((x) => x.conversation_id === convo.id);
    expect(c).toBeTruthy();
    expect(c!.contact_name).toBe("Sam Diaz");
    expect(c!.contact_email).toBe("sam@example.test");
    expect(c!.session_id).toBeNull();

    // Source filter separates chatbot requests from screening requests.
    const chatList = await caller(adminId).case.list({
      source: "chatbot",
      limit: 100,
    });
    expect(chatList.data.some((x) => x.id === c!.id)).toBe(true);
    expect(chatList.data.every((x) => x.source === "chatbot")).toBe(true);

    const screeningList = await caller(adminId).case.list({
      source: "screening",
      limit: 100,
    });
    expect(screeningList.data.some((x) => x.id === c!.id)).toBe(false);
    expect(screeningList.data.every((x) => x.source === "screening")).toBe(true);

    // Second handoff is still rejected (idempotent — no duplicate case).
    await expectCode(
      caller(null).ai.handoff({ conversation_id: convo.id }),
      "BAD_REQUEST",
    );

    await db.cases.delete({ where: { id: c!.id } });
  });

  it("question create/update is admin-gated and validates single_select", async () => {
    const key = `test_q_${randomUUID().slice(0, 8)}`;
    await expectCode(
      caller(residentId).question.create({
        question_key: key,
        answer_type: "integer",
        display_order: 99,
        prompts: { en: { prompt: "How many?" } },
      }),
      "FORBIDDEN",
    );

    // single_select with too few options is rejected.
    await expectCode(
      caller(adminId).question.create({
        question_key: key,
        answer_type: "single_select",
        display_order: 99,
        prompts: { en: { prompt: "Pick" } },
      }),
      "BAD_REQUEST",
    );

    const q = await caller(adminId).question.create({
      question_key: key,
      answer_type: "single_select",
      display_order: 99,
      prompts: { en: { prompt: "Pick one" }, es: { prompt: "Elige uno" } },
      options: [
        { option_key: "a", en: "A", es: "A" },
        { option_key: "b", en: "B", es: "B" },
      ],
    });
    expect(q.id).toBeTruthy();

    const list = await caller(null).question.list({ language_code: "en" });
    const found = list.find((x) => x.id === q.id);
    expect(found?.options.length).toBe(2);

    // Dropping below two options on a single_select is rejected.
    await expectCode(
      caller(adminId).question.update({
        id: q.id,
        options: [{ option_key: "a", en: "A", es: "A" }],
      }),
      "BAD_REQUEST",
    );

    const updated = await caller(adminId).question.update({
      id: q.id,
      display_order: 100,
      prompts: { en: { prompt: "Pick exactly one" } },
    });
    expect(updated.id).toBe(q.id);

    await db.questions.delete({ where: { id: q.id } });
  });

  it("question delete is admin-gated and clears answers (no FK error)", async () => {
    const key = `test_qdel_${randomUUID().slice(0, 8)}`;
    const q = await caller(adminId).question.create({
      question_key: key,
      answer_type: "integer",
      display_order: 98,
      prompts: { en: { prompt: "How many?" } },
    });

    // A resident answers it, so a screening_answers row references the question
    // (its FK is NoAction — delete must clear it rather than erroring).
    const session = await newSession(residentId);
    await caller(residentId).answer.upsert({
      session_id: session.id,
      question_id: q.id,
      answer_value: 3,
    });

    await expectCode(caller(residentId).question.delete({ id: q.id }), "FORBIDDEN");

    const res = await caller(adminId).question.delete({ id: q.id });
    expect(res.deleted).toBe(true);

    const list = await caller(null).question.list({ language_code: "en" });
    expect(list.some((x) => x.id === q.id)).toBe(false);

    await expectCode(caller(adminId).question.delete({ id: q.id }), "NOT_FOUND");
  });

  it("completing a session stamps completed_at (idempotent) and counts in reports", async () => {
    const session = await newSession(null);
    const before = await db.screening_sessions.findUnique({
      where: { id: session.id },
      select: { completed_at: true },
    });
    expect(before?.completed_at).toBeNull();

    const done = await caller(null).screeningSession.complete({
      session_id: session.id,
    });
    expect(done.completed_at).toBeTruthy();

    // Idempotent — a second call keeps the original timestamp.
    const again = await caller(null).screeningSession.complete({
      session_id: session.id,
    });
    expect(again.completed_at?.getTime()).toBe(done.completed_at?.getTime());

    const overview = await caller(adminId).report.overview({});
    expect(overview.completed_sessions).toBeGreaterThanOrEqual(1);
  });

  it("knowledge sources are admin-managed (CRUD)", async () => {
    await expectCode(caller(residentId).knowledge.list(), "FORBIDDEN");
    await expectCode(
      caller(residentId).knowledge.create({
        title: "x",
        source_url: "https://example.test/kb",
        content_text: "info",
      }),
      "FORBIDDEN",
    );

    const created = await caller(adminId).knowledge.create({
      title: "Test KB source",
      source_url: "https://example.test/kb",
      content_text: "Eligibility info for testing.",
      language_code: "en",
    });
    expect(created.id).toBeTruthy();
    expect(created.embedded).toBe(false); // AI disabled in tests

    const list = await caller(adminId).knowledge.list();
    const row = list.find((x) => x.id === created.id);
    expect(row?.title).toBe("Test KB source");
    expect(row?.embedded).toBe(false);

    const updated = await caller(adminId).knowledge.update({
      id: created.id,
      title: "Updated KB source",
    });
    expect(updated.id).toBe(created.id);

    const del = await caller(adminId).knowledge.delete({ id: created.id });
    expect(del.deleted).toBe(true);
    await expectCode(
      caller(adminId).knowledge.delete({ id: created.id }),
      "NOT_FOUND",
    );
  });

  it("records audit entries for sensitive actions; log is admin-only", async () => {
    await expectCode(caller(residentId).audit.list(), "FORBIDDEN");

    // An audited admin action.
    const key = `test_audit_prog_${randomUUID().slice(0, 8)}`;
    const created = await caller(adminId).program.create({
      program_key: key,
      category: "test",
      authoritative_url: "https://example.test",
      translations: { en: { name: "Audit Test", short_description: "d", next_steps: "n" } },
    });

    const log = await caller(adminId).audit.list({
      entity_type: "program",
      limit: 100,
    });
    const entry = log.data.find(
      (e) => e.action === "program.create" && e.entity_id === created.id,
    );
    expect(entry).toBeTruthy();
    expect(entry!.actor).toBeTruthy(); // recorded the acting admin

    const facets = await caller(adminId).audit.facets();
    expect(facets.entity_types).toContain("program");

    await db.programs.delete({ where: { id: created.id } });
  });

  it("organizations CRUD is admin-gated; delete blocked while referenced", async () => {
    const pub = await caller(null).organization.list();
    expect(Array.isArray(pub)).toBe(true);

    await expectCode(
      caller(residentId).organization.create({
        name: "X",
        organization_type: "food_bank",
      }),
      "FORBIDDEN",
    );

    const org = await caller(adminId).organization.create({
      name: "Test Food Bank",
      organization_type: "food_bank",
      email: "fb@example.test",
      service_categories: ["food"],
    });
    expect(org.id).toBeTruthy();

    const fetched = await caller(null).organization.byId({ id: org.id });
    expect(fetched.name).toBe("Test Food Bank");

    await caller(adminId).organization.update({
      id: org.id,
      name: "Updated Food Bank",
    });

    // Referencing referral blocks deletion.
    const session = await newSession(residentId);
    const ref = await caller(residentId).referral.create({
      session_id: session.id,
      organization_id: org.id,
      need_category: "food",
    });
    await expectCode(
      caller(adminId).organization.delete({ id: org.id }),
      "CONFLICT",
    );

    await db.referrals.delete({ where: { id: ref.id } });
    const del = await caller(adminId).organization.delete({ id: org.id });
    expect(del.deleted).toBe(true);
  });

  it("referral detail/update — owner and staff; marking sent stamps sent_at", async () => {
    const session = await newSession(residentId);
    const ref = await caller(residentId).referral.create({
      session_id: session.id,
      need_category: "housing",
    });

    expect((await caller(residentId).referral.byId({ id: ref.id })).id).toBe(ref.id);
    expect((await caller(caseworkerId).referral.byId({ id: ref.id })).id).toBe(ref.id);

    const updated = await caller(caseworkerId).referral.update({
      id: ref.id,
      status: "sent",
      notes: "Referred to a local shelter.",
    });
    expect(updated.status).toBe("sent");
    expect(updated.sent_at).toBeTruthy();

    await db.referrals.delete({ where: { id: ref.id } });
  });

  it("deleteAccount erases personal data, severs login, keeps an anonymized row", async () => {
    const tag = randomUUID().slice(0, 8);
    const authUser = await db.user.create({
      data: { email: `del-${tag}@example.test` },
    });
    const domain = await db.users.create({
      data: {
        email: `del-${tag}@example.test`,
        auth_user_id: authUser.id,
        role: "resident",
      },
    });
    const session = await db.screening_sessions.create({
      data: { user_id: domain.id },
    });

    // A caller whose NextAuth id is the real one (so the login row is removed).
    const self = createCaller({
      db,
      session: {
        user: { id: authUser.id, appUserId: domain.id, role: null },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
      },
      headers: new Headers(),
    });
    const res = await self.user.deleteAccount();
    expect(res.deleted).toBe(true);

    // Personal data gone; login severed; row kept but anonymized + unlinked.
    expect(
      await db.screening_sessions.findUnique({ where: { id: session.id } }),
    ).toBeNull();
    expect(await db.user.findUnique({ where: { id: authUser.id } })).toBeNull();
    const after = await db.users.findUnique({
      where: { id: domain.id },
      select: { email: true, auth_user_id: true },
    });
    expect(after?.email).toBeNull();
    expect(after?.auth_user_id).toBeNull();

    // cleanup (audit actor FK is NoAction → clear before removing the row)
    await db.audit_logs.deleteMany({ where: { actor_user_id: domain.id } });
    await db.users.delete({ where: { id: domain.id } });
  });
});

describe("Phase 3 — profile, notifications, referrals", () => {
  it("updates the caller's profile and rejects an unknown language", async () => {
    const me = caller(residentId);
    const updated = await me.user.update({ preferred_language: "en" });
    expect(updated.preferred_language).toBe("en");

    const withPhone = await me.user.update({ phone: "+15551234567" });
    expect(withPhone.phone).toBe("+15551234567");

    await expectCode(me.user.update({ preferred_language: "zz" }), "BAD_REQUEST");
  });

  it("requires auth for user.update", async () => {
    await expectCode(
      caller(null).user.update({ preferred_language: "en" }),
      "UNAUTHORIZED",
    );
  });

  it("upserts a session-scoped notification preference idempotently", async () => {
    const session = await newSession();
    const me = caller(null);

    const pref = await me.notificationPreference.upsert({
      session_id: session.id,
      channel: "email",
      destination: "resident@example.test",
    });
    expect(pref.session_id).toBe(session.id);
    expect(pref.channel).toBe("email");

    // Same (session, channel, destination) updates in place rather than duping.
    await me.notificationPreference.upsert({
      session_id: session.id,
      channel: "email",
      destination: "resident@example.test",
      frequency: "daily_digest",
    });
    const list = await me.notificationPreference.list({ session_id: session.id });
    expect(list.length).toBe(1);
    expect(list[0]?.frequency).toBe("daily_digest");
  });

  it("requires auth or a session id to list preferences", async () => {
    await expectCode(caller(null).notificationPreference.list(), "UNAUTHORIZED");
  });

  it("creates a referral and lists it; 404s on an unknown org", async () => {
    const session = await newSession();
    const me = caller(null);

    const referral = await me.referral.create({
      session_id: session.id,
      need_category: "food",
      notes: "Needs a food bank nearby",
    });
    expect(referral.session_id).toBe(session.id);
    expect(referral.need_category).toBe("food");

    const list = await me.referral.list({ session_id: session.id });
    expect(list.find((r) => r.id === referral.id)).toBeTruthy();

    await expectCode(
      me.referral.create({
        session_id: session.id,
        need_category: "housing",
        organization_id: randomUUID(),
      }),
      "NOT_FOUND",
    );
  });
});

describe("Rate limiting", () => {
  it("allows up to the limit, blocks within the window, then recovers", () => {
    const key = `unit-${randomUUID()}`;
    const opts = { limit: 3, windowMs: 1000 };
    const t0 = 1_000_000;

    expect(checkRateLimit(key, opts, t0).allowed).toBe(true);
    expect(checkRateLimit(key, opts, t0 + 1).allowed).toBe(true);
    const third = checkRateLimit(key, opts, t0 + 2);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = checkRateLimit(key, opts, t0 + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);

    // Once the window slides past the first hit, a slot frees up.
    expect(checkRateLimit(key, opts, t0 + 1001).allowed).toBe(true);
  });

  it("returns TOO_MANY_REQUESTS once the AI limit is exceeded", async () => {
    // Unique client IP so this bucket is isolated from other tests.
    const headers = new Headers({ "x-forwarded-for": `rl-${randomUUID()}` });
    const client = createCaller({ db, session: null, headers });

    // The AI procedure allows 10/min; the 11th call from this client is blocked.
    for (let i = 0; i < 10; i++) {
      const res = await client.ai.ask({ question: `rate-limit probe ${i}` });
      createdConversationIds.push(res.conversation_id);
    }
    await expectCode(
      client.ai.ask({ question: "one too many" }),
      "TOO_MANY_REQUESTS",
    );
  });

  it("enforces the limit via the Postgres backend", async () => {
    const key = `pg-${randomUUID()}`;
    const opts = { limit: 2, windowMs: 60_000 };
    try {
      expect((await checkRateLimitPg(db, key, opts)).allowed).toBe(true);
      const second = await checkRateLimitPg(db, key, opts);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(0);

      const blocked = await checkRateLimitPg(db, key, opts);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    } finally {
      await db.rate_limits.delete({ where: { key } }).catch(() => undefined);
    }
  });
});

describe("Eligibility explainer", () => {
  it("extracts reasons from the rules-engine explanation JSON", () => {
    expect(extractReasons({ reasons: ["a", "b"] })).toEqual(["a", "b"]);
    expect(extractReasons({ reasons: ["a", 2, null] })).toEqual(["a"]);
    expect(extractReasons({})).toEqual([]);
    expect(extractReasons(null)).toEqual([]);
    expect(extractReasons("not an object")).toEqual([]);
  });

  it("builds a deterministic fallback explanation for any outcome", () => {
    const fb = buildFallbackExplanation("may_be_eligible", "SNAP", [
      "Income within range",
    ]);
    expect(fb.explanation).toContain("SNAP");
    expect(fb.explanation.toLowerCase()).toContain("may be eligible");
    expect(fb.key_factors).toEqual(["Income within range"]);
    expect(fb.next_steps.length).toBeGreaterThan(0);
  });

  it("returns NOT_FOUND when the program has no result in the session", async () => {
    const session = await newSession();
    await expectCode(
      caller(null).ai.explainEligibility({
        session_id: session.id,
        program_id: randomUUID(),
        language_code: "en",
      }),
      "NOT_FOUND",
    );
  });
});
