/**
 * Schema integrity smoke test — FK behavior, NOT NULL enforcement, default values.
 *
 * Sections:
 *   1. Foreign keys — Cascade / SetNull / NoAction propagation across related tables.
 *   2. NOT NULL    — raw INSERTs that omit a required column are rejected by the DB.
 *   3. Defaults    — minimal INSERTs come back with the documented default values.
 *
 * Idempotent: tagged with sentinel values (email, fingerprint, detector, etc.) so
 * cleanup is reliable. Requires reference data from `prisma/seed.ts` to already
 * be present (programs, questions, rule versions).
 */

import { Prisma, PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient({ log: [] });

const SENTINEL_EMAIL = "fk-test@bridge.local";
const SENTINEL_FINGERPRINT = "fk-test-fingerprint";
const SENTINEL_DETECTOR = "fk-test";
const SENTINEL_QUERY = "fk-test query";
const SENTINEL_NULL_PROGRAM = "null-test-prog";
const SENTINEL_DEFAULTS_EMAIL = "defaults-test@bridge.local";

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}`);
  }
}

function isFkError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2003" || e.code === "P2014")
  );
}

function isNullError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  // P2011 = Prisma client-side null constraint violation
  if (e.code === "P2011") return true;
  // P2010 = raw query failed; check PG SQLSTATE in meta (23502 = not_null_violation)
  if (e.code === "P2010") {
    const meta = e.meta as { code?: string } | undefined;
    return meta?.code === "23502";
  }
  return false;
}

async function expectNullError(label: string, sql: string) {
  try {
    await db.$executeRawUnsafe(sql);
    check(label, false);
  } catch (e) {
    check(label, isNullError(e));
  }
}

async function cleanup() {
  await db.anomaly_flags.deleteMany({ where: { detector: SENTINEL_DETECTOR } });
  await db.search_queries.deleteMany({ where: { query_text: SENTINEL_QUERY } });
  await db.audit_logs.deleteMany({ where: { action: "fk-test" } });
  await db.users.deleteMany({
    where: { email: { in: [SENTINEL_EMAIL, SENTINEL_DEFAULTS_EMAIL] } },
  });
  await db.user.deleteMany({
    where: { email: { in: [SENTINEL_EMAIL, SENTINEL_DEFAULTS_EMAIL] } },
  });
  await db.programs.deleteMany({
    where: { program_key: { startsWith: SENTINEL_NULL_PROGRAM } },
  });
  await db.organizations.deleteMany({
    where: { name: "defaults-test-org" },
  });
}

async function requireReferenceData() {
  const snap = await db.programs.findUnique({ where: { program_key: "snap" } });
  const question = await db.questions.findUnique({
    where: { question_key: "household_size" },
  });
  if (!snap || !question) {
    throw new Error(
      "Reference data missing. Run `npx prisma db seed` first.",
    );
  }
  const ruleVersion = await db.eligibility_rule_versions.findFirst({
    where: { program_id: snap.id, version: 1 },
  });
  if (!ruleVersion) {
    throw new Error(
      "Reference data missing: no eligibility_rule_versions row for snap@v1.",
    );
  }
  return { snap, question, ruleVersion };
}

async function main() {
  console.log("\nSchema smoke test\n");
  await cleanup();

  const { snap, question, ruleVersion } = await requireReferenceData();

  // ────────────────────────────────────────────────────────────────────────
  // Build scenario (used by FK and NOT NULL tests)
  // ────────────────────────────────────────────────────────────────────────
  console.log("Building scenario:");

  const authUser = await db.user.create({
    data: { email: SENTINEL_EMAIL, name: "FK Test" },
  });

  const appUser = await db.users.create({
    data: { email: SENTINEL_EMAIL, auth_user_id: authUser.id },
  });
  check(
    "users.auth_user_id links to NextAuth User.id",
    appUser.auth_user_id === authUser.id,
  );
  check(
    "users.id and User.id are independent UUIDs",
    appUser.id !== authUser.id,
  );

  const session = await db.screening_sessions.create({
    data: {
      user_id: appUser.id,
      preferred_language: "en",
      current_step: 1,
      ip_address: "127.0.0.1",
      user_agent: "fk-test",
      fingerprint_hash: SENTINEL_FINGERPRINT,
    },
  });

  await db.resume_tokens.create({
    data: {
      session_id: session.id,
      channel: "email",
      destination: SENTINEL_EMAIL,
      token_hash: "test-hash",
      expires_at: new Date(Date.now() + 3_600_000),
    },
  });

  await db.screening_answers.create({
    data: {
      session_id: session.id,
      question_id: question.id,
      answer_value: { value: 3 },
    },
  });

  await db.eligibility_results.create({
    data: {
      session_id: session.id,
      program_id: snap.id,
      rule_version_id: ruleVersion.id,
      outcome: "may_be_eligible",
      priority_rank: 1,
      explanation: { rationale: "fk test" },
    },
  });

  const docType = await db.document_types.upsert({
    where: { doc_key: "paystub" },
    update: {},
    create: { doc_key: "paystub", category: "income" },
  });

  const upload = await db.document_uploads.create({
    data: {
      session_id: session.id,
      document_type_id: docType.id,
      predicted_document_type_id: docType.id,
      classification_confidence: new Prisma.Decimal("0.950"),
      classified_by: "ai",
      classified_at: new Date(),
      file_name: "paystub.pdf",
      file_mime_type: "application/pdf",
      storage_url: "memory://fk-test/paystub.pdf",
    },
  });

  await db.document_classifications.create({
    data: {
      document_upload_id: upload.id,
      document_type_id: docType.id,
      confidence: new Prisma.Decimal("0.950"),
      classified_by: "ai",
      model_name: "fk-test-model",
    },
  });

  await db.session_document_checklist.create({
    data: {
      session_id: session.id,
      program_id: snap.id,
      document_type_id: docType.id,
      reason: { reason: "income verification" },
    },
  });

  const conversation = await db.ai_conversations.create({
    data: {
      session_id: session.id,
      user_id: appUser.id,
      language_code: "en",
    },
  });
  await db.ai_messages.create({
    data: {
      conversation_id: conversation.id,
      role: "user",
      content: "fk test message",
    },
  });

  await db.ai_recommendations.create({
    data: {
      session_id: session.id,
      user_id: appUser.id,
      target_type: "program",
      target_id: snap.id,
      rationale: "fk test",
      score: new Prisma.Decimal("0.800"),
    },
  });

  await db.anomaly_flags.create({
    data: {
      session_id: session.id,
      user_id: appUser.id,
      flag_type: "duplicate_submission",
      severity: "low",
      detector: SENTINEL_DETECTOR,
      payload: { fingerprint: SENTINEL_FINGERPRINT },
    },
  });

  await db.notification_preferences.create({
    data: {
      session_id: session.id,
      user_id: appUser.id,
      channel: "email",
      destination: SENTINEL_EMAIL,
      frequency: "important_only",
    },
  });

  const orphanReferral = await db.referrals.create({
    data: {
      session_id: session.id,
      organization_id: null,
      need_category: "in_person_help",
    },
  });
  check(
    "referrals.organization_id accepts NULL (in-person help)",
    orphanReferral.organization_id === null,
  );

  const caseRow = await db.cases.create({
    data: {
      session_id: session.id,
      assigned_to: appUser.id,
      status: "new",
      priority: "normal",
    },
  });
  await db.case_notes.create({
    data: {
      case_id: caseRow.id,
      author_id: appUser.id,
      note: "fk test note",
    },
  });

  await db.search_queries.create({
    data: {
      session_id: session.id,
      user_id: appUser.id,
      query_text: SENTINEL_QUERY,
      language_code: "en",
    },
  });

  // ────────────────────────────────────────────────────────────────────────
  // NOT NULL enforcement (raw SQL — bypasses Prisma client validation)
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nNOT NULL constraints (DB rejects INSERT):");

  await expectNullError(
    "programs.authoritative_url NOT NULL",
    `INSERT INTO programs (id, program_key, category) VALUES (gen_random_uuid(), '${SENTINEL_NULL_PROGRAM}-1', 'food')`,
  );

  await expectNullError(
    "programs.program_key NOT NULL",
    `INSERT INTO programs (id, category, authoritative_url) VALUES (gen_random_uuid(), 'food', 'https://x.test/')`,
  );

  await expectNullError(
    "programs.category NOT NULL",
    `INSERT INTO programs (id, program_key, authoritative_url) VALUES (gen_random_uuid(), '${SENTINEL_NULL_PROGRAM}-2', 'https://x.test/')`,
  );

  await expectNullError(
    "ai_messages.content NOT NULL",
    `INSERT INTO ai_messages (id, conversation_id, role) VALUES (gen_random_uuid(), '${conversation.id}', 'user')`,
  );

  await expectNullError(
    "ai_messages.role NOT NULL",
    `INSERT INTO ai_messages (id, conversation_id, content) VALUES (gen_random_uuid(), '${conversation.id}', 'x')`,
  );

  await expectNullError(
    "referrals.need_category NOT NULL",
    `INSERT INTO referrals (id, session_id) VALUES (gen_random_uuid(), '${session.id}')`,
  );

  await expectNullError(
    "document_uploads.file_name NOT NULL",
    `INSERT INTO document_uploads (id, session_id, file_mime_type, storage_url) VALUES (gen_random_uuid(), '${session.id}', 'application/pdf', 'memory://x')`,
  );

  await expectNullError(
    "document_uploads.storage_url NOT NULL",
    `INSERT INTO document_uploads (id, session_id, file_name, file_mime_type) VALUES (gen_random_uuid(), '${session.id}', 'a.pdf', 'application/pdf')`,
  );

  await expectNullError(
    "eligibility_rule_versions.rules_json NOT NULL",
    `INSERT INTO eligibility_rule_versions (id, program_id, version, effective_from) VALUES (gen_random_uuid(), '${snap.id}', 99, CURRENT_DATE)`,
  );

  await expectNullError(
    "audit_logs.action NOT NULL",
    `INSERT INTO audit_logs (id, entity_type) VALUES (gen_random_uuid(), 'test')`,
  );

  await expectNullError(
    "audit_logs.entity_type NOT NULL",
    `INSERT INTO audit_logs (id, action) VALUES (gen_random_uuid(), 'test')`,
  );

  await expectNullError(
    "anomaly_flags.flag_type NOT NULL",
    `INSERT INTO anomaly_flags (id, session_id) VALUES (gen_random_uuid(), '${session.id}')`,
  );

  // ────────────────────────────────────────────────────────────────────────
  // FK NoAction — refuse delete of referenced parents
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nFK NoAction (delete rejected):");

  try {
    await db.languages.delete({ where: { code: "en" } });
    check("languages.delete('en') is rejected", false);
  } catch (e) {
    check("languages.delete('en') is rejected", isFkError(e));
  }

  try {
    await db.programs.delete({ where: { id: snap.id } });
    check("programs.delete(snap) is rejected", false);
  } catch (e) {
    check("programs.delete(snap) is rejected", isFkError(e));
  }

  try {
    await db.document_types.delete({ where: { id: docType.id } });
    check("document_types.delete(paystub) is rejected", false);
  } catch (e) {
    check("document_types.delete(paystub) is rejected", isFkError(e));
  }

  // ────────────────────────────────────────────────────────────────────────
  // FK Cascade — session delete sweeps children
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nFK Cascade (session delete):");

  await db.screening_sessions.delete({ where: { id: session.id } });

  check(
    "screening_answers cascade-deleted",
    (await db.screening_answers.count({ where: { session_id: session.id } })) ===
      0,
  );
  check(
    "resume_tokens cascade-deleted",
    (await db.resume_tokens.count({ where: { session_id: session.id } })) === 0,
  );
  check(
    "eligibility_results cascade-deleted",
    (await db.eligibility_results.count({ where: { session_id: session.id } })) ===
      0,
  );
  check(
    "document_uploads cascade-deleted",
    (await db.document_uploads.count({ where: { session_id: session.id } })) === 0,
  );
  check(
    "document_classifications cascade-deleted via upload",
    (await db.document_classifications.count({
      where: { document_upload_id: upload.id },
    })) === 0,
  );
  check(
    "session_document_checklist cascade-deleted",
    (await db.session_document_checklist.count({
      where: { session_id: session.id },
    })) === 0,
  );
  check(
    "ai_conversations cascade-deleted",
    (await db.ai_conversations.count({ where: { session_id: session.id } })) === 0,
  );
  check(
    "ai_messages cascade-deleted via conversation",
    (await db.ai_messages.count({
      where: { conversation_id: conversation.id },
    })) === 0,
  );
  check(
    "ai_recommendations cascade-deleted",
    (await db.ai_recommendations.count({ where: { session_id: session.id } })) ===
      0,
  );
  check(
    "notification_preferences cascade-deleted",
    (await db.notification_preferences.count({
      where: { session_id: session.id },
    })) === 0,
  );
  check(
    "referrals cascade-deleted",
    (await db.referrals.count({ where: { session_id: session.id } })) === 0,
  );
  check(
    "cases cascade-deleted",
    (await db.cases.count({ where: { session_id: session.id } })) === 0,
  );
  check(
    "case_notes cascade-deleted via case",
    (await db.case_notes.count({ where: { case_id: caseRow.id } })) === 0,
  );

  // ────────────────────────────────────────────────────────────────────────
  // FK SetNull — child survives, FK column clears
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nFK SetNull:");

  const survivingFlag = await db.anomaly_flags.findFirst({
    where: { detector: SENTINEL_DETECTOR },
  });
  check("anomaly_flags row survives session delete", survivingFlag !== null);
  check(
    "anomaly_flags.session_id is NULL after session delete",
    survivingFlag?.session_id === null,
  );
  check(
    "anomaly_flags.user_id still references appUser",
    survivingFlag?.user_id === appUser.id,
  );

  const survivingQuery = await db.search_queries.findFirst({
    where: { query_text: SENTINEL_QUERY },
  });
  check("search_queries row survives session delete", survivingQuery !== null);
  check(
    "search_queries.session_id is NULL after session delete",
    survivingQuery?.session_id === null,
  );

  const auditLog = await db.audit_logs.create({
    data: {
      actor_user_id: appUser.id,
      action: "fk-test",
      entity_type: "users",
      entity_id: appUser.id,
    },
  });

  try {
    await db.users.delete({ where: { id: appUser.id } });
    check("users.delete is rejected while audit_logs reference it", false);
  } catch (e) {
    check(
      "users.delete is rejected while audit_logs reference it",
      isFkError(e),
    );
  }

  await db.audit_logs.delete({ where: { id: auditLog.id } });

  await db.user.delete({ where: { id: authUser.id } });
  const orphanedAppUser = await db.users.findUnique({
    where: { id: appUser.id },
  });
  check("users row survives auth User delete", orphanedAppUser !== null);
  check(
    "users.auth_user_id is NULL after auth User delete",
    orphanedAppUser?.auth_user_id === null,
  );

  // ────────────────────────────────────────────────────────────────────────
  // Default values
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nDefault values:");

  const defaultsUser = await db.users.create({
    data: { email: SENTINEL_DEFAULTS_EMAIL },
  });
  check("users.role defaults to 'resident'", defaultsUser.role === "resident");
  check(
    "users.preferred_language defaults to 'en'",
    defaultsUser.preferred_language === "en",
  );
  check(
    "users.created_at is set by default",
    defaultsUser.created_at instanceof Date,
  );

  const defaultsSession = await db.screening_sessions.create({ data: {} });
  check(
    "screening_sessions.current_step defaults to 0",
    defaultsSession.current_step === 0,
  );
  check(
    "screening_sessions.preferred_language defaults to 'en'",
    defaultsSession.preferred_language === "en",
  );
  check(
    "screening_sessions.created_at is set by default",
    defaultsSession.created_at instanceof Date,
  );

  const defaultsConvo = await db.ai_conversations.create({
    data: { session_id: defaultsSession.id },
  });
  check(
    "ai_conversations.language_code defaults to 'en'",
    defaultsConvo.language_code === "en",
  );
  check(
    "ai_conversations.human_handoff_requested defaults to false",
    defaultsConvo.human_handoff_requested === false,
  );

  const defaultsNotif = await db.notification_preferences.create({
    data: {
      session_id: defaultsSession.id,
      channel: "email",
      destination: "x@y.test",
    },
  });
  check(
    "notification_preferences.frequency defaults to 'important_only'",
    defaultsNotif.frequency === "important_only",
  );
  check(
    "notification_preferences.opted_in defaults to true",
    defaultsNotif.opted_in === true,
  );
  check(
    "notification_preferences.language_code defaults to 'en'",
    defaultsNotif.language_code === "en",
  );

  const defaultsRef = await db.referrals.create({
    data: { session_id: defaultsSession.id, need_category: "housing" },
  });
  check(
    "referrals.status defaults to 'draft'",
    defaultsRef.status === "draft",
  );

  const defaultsUpload = await db.document_uploads.create({
    data: {
      session_id: defaultsSession.id,
      file_name: "x.pdf",
      file_mime_type: "application/pdf",
      storage_url: "memory://x",
    },
  });
  check(
    "document_uploads.status defaults to 'uploaded'",
    defaultsUpload.status === "uploaded",
  );

  const defaultsRec = await db.ai_recommendations.create({
    data: {
      session_id: defaultsSession.id,
      target_type: "program",
      target_id: snap.id,
    },
  });
  check(
    "ai_recommendations.status defaults to 'pending'",
    defaultsRec.status === "pending",
  );

  const defaultsFlag = await db.anomaly_flags.create({
    data: {
      session_id: defaultsSession.id,
      flag_type: "other",
      detector: SENTINEL_DETECTOR,
    },
  });
  check(
    "anomaly_flags.severity defaults to 'low'",
    defaultsFlag.severity === "low",
  );
  check(
    "anomaly_flags.status defaults to 'open'",
    defaultsFlag.status === "open",
  );
  check(
    "anomaly_flags.payload defaults to '{}'",
    JSON.stringify(defaultsFlag.payload) === "{}",
  );

  const defaultsCase = await db.cases.create({
    data: { session_id: defaultsSession.id },
  });
  check("cases.status defaults to 'new'", defaultsCase.status === "new");
  check("cases.priority defaults to 'normal'", defaultsCase.priority === "normal");

  const defaultsOrg = await db.organizations.create({
    data: { name: "defaults-test-org", organization_type: "nonprofit" },
  });
  check(
    "organizations.service_categories defaults to []",
    Array.isArray(defaultsOrg.service_categories) &&
      defaultsOrg.service_categories.length === 0,
  );

  // Cascade-delete the defaults session to clean up its children
  await db.screening_sessions.delete({ where: { id: defaultsSession.id } });

  await cleanup();

  console.log(`\n${passed} passed · ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
