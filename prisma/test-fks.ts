/**
 * Foreign-key smoke test.
 *
 * Builds one realistic screening-session scenario across the related tables,
 * then exercises the three FK behaviors the schema relies on:
 *
 *   - Cascade   — deleting the parent removes its children.
 *   - SetNull   — deleting the parent leaves the child but clears the FK.
 *   - NoAction  — deleting the parent is rejected when children exist.
 *
 * Idempotent: tagged with sentinel values (email, fingerprint, detector) so it
 * cleans up its own rows. Reference data from `prisma/seed.ts` must already
 * be present (programs, questions, rule versions).
 */

import { Prisma, PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient({ log: [] });

const SENTINEL_EMAIL = "fk-test@bridge.local";
const SENTINEL_FINGERPRINT = "fk-test-fingerprint";
const SENTINEL_DETECTOR = "fk-test";
const SENTINEL_QUERY = "fk-test query";

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

async function cleanup() {
  await db.anomaly_flags.deleteMany({ where: { detector: SENTINEL_DETECTOR } });
  await db.search_queries.deleteMany({ where: { query_text: SENTINEL_QUERY } });
  await db.audit_logs.deleteMany({ where: { action: "fk-test" } });
  await db.users.deleteMany({ where: { email: SENTINEL_EMAIL } });
  await db.user.deleteMany({ where: { email: SENTINEL_EMAIL } });
}

async function requireReferenceData() {
  const snap = await db.programs.findUnique({ where: { program_key: "snap" } });
  const question = await db.questions.findUnique({
    where: { question_key: "household_size" },
  });
  if (!snap || !question) {
    throw new Error(
      "Reference data missing. Run `npx prisma db seed` first to load programs and questions.",
    );
  }
  const ruleVersion = await db.eligibility_rule_versions.findFirst({
    where: { program_id: snap.id, version: 1 },
  });
  if (!ruleVersion) {
    throw new Error(
      "Reference data missing: no eligibility_rule_versions row for snap@v1. Run `npx prisma db seed`.",
    );
  }
  return { snap, question, ruleVersion };
}

async function main() {
  console.log("\nFK smoke test\n");
  await cleanup();

  const { snap, question, ruleVersion } = await requireReferenceData();

  // ────────────────────────────────────────────────────────────────────────
  // Build scenario
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
  // NoAction — refuse delete of referenced parents
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nNoAction (delete should be rejected):");

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
  // Cascade — session delete sweeps its children
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nCascade (session delete):");

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
  // SetNull — child survives, FK column clears
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nSetNull (parent gone, child kept with FK cleared):");

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

  // ────────────────────────────────────────────────────────────────────────
  // NoAction on users via audit_logs
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nNoAction (audit_logs prevent user delete):");

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

  // ────────────────────────────────────────────────────────────────────────
  // SetNull — auth User delete clears users.auth_user_id
  // ────────────────────────────────────────────────────────────────────────
  console.log("\nSetNull (NextAuth User delete):");

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
  // Cleanup
  // ────────────────────────────────────────────────────────────────────────
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
