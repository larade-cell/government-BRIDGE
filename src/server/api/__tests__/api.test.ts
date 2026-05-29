import { randomUUID } from "node:crypto";

import type { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// `~/server/auth` pulls in NextAuth (and `next/server`), which Vitest's node
// resolver can't load. The caller builds its session manually and never calls
// `auth()`, so a stub is sufficient.
vi.mock("~/server/auth", () => ({ auth: () => Promise.resolve(null) }));

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
          user: { id: randomUUID(), appUserId },
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
