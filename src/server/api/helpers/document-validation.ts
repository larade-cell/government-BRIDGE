import { type PrismaClient } from "../../../../generated/prisma";
import { isAiEnabled, validateDocument } from "../../../../lib/ai-service";

/** A Prisma client or an interactive-transaction client. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Above this, the model's verdict is trusted; below it routes to human review. */
const VALIDATION_CONFIDENCE_THRESHOLD = 0.7;

/** MIME types the vision model can read directly (PDF/HEIC need conversion). */
const VISION_MIME = ["image/jpeg", "image/png"];

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

  const persist = (
    status: ValidationOutcome["validation_status"],
    reason: string | null,
    confidence: number | null = null,
  ) =>
    db.document_uploads
      .update({
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
      })
      .then((r) => ({
        validation_status: r.validation_status as ValidationOutcome["validation_status"],
        validation_reason: r.validation_reason,
        validation_confidence: r.validation_confidence
          ? Number(r.validation_confidence)
          : null,
      }));

  // Can't check what wasn't claimed, fetched, or readable by the vision model —
  // and don't pretend to when AI is off. All of these defer to a human.
  if (!upload.document_type_id || !upload.document_types) {
    return persist(
      "needs_review",
      "No document type was selected, so this needs a manual check.",
    );
  }
  if (!isAiEnabled()) {
    return persist("needs_review", "Awaiting review.");
  }
  if (upload.storage_url.startsWith("pending://")) {
    return persist("needs_review", "The file isn't available to check yet.");
  }
  if (!VISION_MIME.includes(upload.file_mime_type)) {
    return persist(
      "needs_review",
      "This file type can't be checked automatically yet.",
    );
  }

  const tr = upload.document_types.document_type_translations[0];
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

  return persist(status, result.reason || null, result.confidence);
}
