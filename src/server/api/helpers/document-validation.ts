import { type PrismaClient } from "../../../../generated/prisma";
import { isAiEnabled, validateDocument } from "../../../../lib/ai-service";

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Above this, the model's verdict is trusted; below it routes to human review. */
const VALIDATION_CONFIDENCE_THRESHOLD = 0.7;

/** MIME types the vision model can read directly (PDF/HEIC need conversion). */
const VISION_MIME = ["image/jpeg", "image/png"];

/** Case statuses that count as an open case (mirrors caseRouter). */
const OPEN_CASE_STATUSES = ["new", "in_progress", "waiting_on_client"] as const;

/**
 * Put a document that needs human review into the caseworker queue: attach an
 * internal note to the session's open case, or open a fresh `document_review`
 * case if none exists. Idempotent at the case level — one open case per session
 * — so several flagged documents add notes to one case instead of flooding the
 * queue. Best-effort: a queue failure must never fail document validation.
 */
async function flagDocumentForReview(
  db: Db,
  params: { sessionId: string; documentLabel: string; reason: string | null },
): Promise<void> {
  const note = `Document needs review: ${params.documentLabel}.${
    params.reason ? ` ${params.reason}` : ""
  }`;
  const existing = await db.cases.findFirst({
    where: {
      session_id: params.sessionId,
      status: { in: [...OPEN_CASE_STATUSES] },
    },
    orderBy: { created_at: "desc" },
    select: { id: true },
  });
  const caseId =
    existing?.id ??
    (
      await db.cases.create({
        data: {
          session_id: params.sessionId,
          status: "new",
          source: "document_review",
          priority: "normal",
          priority_reason: "Uploaded document needs manual review.",
        },
        select: { id: true },
      })
    ).id;
  if (existing) {
    await db.cases.update({
      where: { id: caseId },
      data: { updated_at: new Date() },
    });
  }
  await db.case_notes.create({
    data: { case_id: caseId, author_id: null, note, is_internal: true },
  });
}

type ValidationOutcome = {
  validation_status: "valid" | "invalid" | "unreadable" | "needs_review";
  validation_reason: string | null;
  validation_confidence: number | null;
};

/**
 * Validate one uploaded document against the type the applicant claimed, and
 * persist the verdict on the row. Assistive and fail-safe: anything the model
 * can't confidently judge — AI disabled, unreadable file, low confidence, an
 * unsupported format, or a missing claimed type — lands in `needs_review` for a
 * human, never silently `valid`. Returns the persisted verdict, or `null` if
 * the upload no longer exists.
 *
 * Shared by the client-triggered `documentUpload.validate` mutation and the
 * storage `finalize` webhook so both reach the same verdict.
 */
export async function runUploadValidation(
  db: Db,
  uploadId: string,
  languageCode = "en",
): Promise<ValidationOutcome | null> {
  const upload = await db.document_uploads.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      session_id: true,
      file_name: true,
      storage_url: true,
      file_mime_type: true,
      document_type_id: true,
      document_types: {
        select: {
          doc_key: true,
          document_type_translations: {
            where: { language_code: languageCode },
            select: { name: true, description: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!upload) return null;

  const tr = upload.document_types?.document_type_translations[0];
  const documentLabel =
    tr?.name ?? upload.document_types?.doc_key ?? upload.file_name;

  // Persist the verdict on the upload. When the outcome is `needs_review` and
  // it's a terminal one (not a transient "file not ready yet"), also route the
  // document into the caseworker queue — best-effort, never failing validation.
  const persist = async (
    status: ValidationOutcome["validation_status"],
    reason: string | null,
    confidence: number | null = null,
    queueForReview = false,
  ): Promise<ValidationOutcome> => {
    const r = await db.document_uploads.update({
      where: { id: uploadId },
      data: {
        validation_status: status,
        validation_reason: reason,
        validation_confidence: confidence,
        validated_at: new Date(),
      },
      select: {
        validation_status: true,
        validation_reason: true,
        validation_confidence: true,
      },
    });
    if (status === "needs_review" && queueForReview) {
      try {
        await flagDocumentForReview(db, {
          sessionId: upload.session_id,
          documentLabel,
          reason,
        });
      } catch (err) {
        console.error("[document-validation] failed to queue review case:", err);
      }
    }
    return {
      validation_status:
        r.validation_status as ValidationOutcome["validation_status"],
      validation_reason: r.validation_reason,
      validation_confidence: r.validation_confidence
        ? Number(r.validation_confidence)
        : null,
    };
  };

  // Can't check what wasn't claimed, fetched, or readable by the vision model —
  // and don't pretend to when AI is off. All defer to a human, and all but the
  // transient "not fetched yet" go straight into the review queue.
  if (!upload.document_type_id || !upload.document_types) {
    return persist(
      "needs_review",
      "No document type was selected, so this needs a manual check.",
      null,
      true,
    );
  }
  if (!isAiEnabled()) {
    return persist("needs_review", "Awaiting review.", null, true);
  }
  if (upload.storage_url.startsWith("pending://")) {
    // Transient: validation re-runs from `finalize` once the bytes land, so
    // don't open a case yet.
    return persist("needs_review", "The file isn't available to check yet.");
  }
  if (!VISION_MIME.includes(upload.file_mime_type)) {
    return persist(
      "needs_review",
      "This file type can't be checked automatically yet.",
      null,
      true,
    );
  }

  const result = await validateDocument({
    imageUrl: upload.storage_url,
    expectedType: {
      doc_key: upload.document_types.doc_key,
      name: tr?.name ?? upload.document_types.doc_key,
      description: tr?.description ?? null,
    },
    language_code: languageCode,
  });
  if (!result) {
    return persist(
      "needs_review",
      "Automatic check was unavailable; awaiting review.",
      null,
      true,
    );
  }

  const confident = result.confidence >= VALIDATION_CONFIDENCE_THRESHOLD;
  const status: ValidationOutcome["validation_status"] =
    result.verdict === "valid" && result.matches_type && confident
      ? "valid"
      : result.verdict === "invalid" && confident
        ? "invalid"
        : result.verdict === "unreadable"
          ? "unreadable"
          : "needs_review";

  // A low-confidence verdict that fell through to needs_review goes to a human.
  return persist(status, result.reason || null, result.confidence, true);
}
