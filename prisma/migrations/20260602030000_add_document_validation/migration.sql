-- Document validation: a verdict on whether an uploaded file genuinely is a
-- legible document of its claimed type. Separate from `upload_status` (the
-- file/OCR lifecycle). Previously a user-tagged upload was shown as "verified"
-- with no check at all; this gives validation its own, honest axis.

-- CreateEnum
CREATE TYPE "validation_status" AS ENUM ('unvalidated', 'valid', 'invalid', 'unreadable', 'needs_review');

-- AlterTable
ALTER TABLE "document_uploads"
  ADD COLUMN "validation_status" "validation_status" NOT NULL DEFAULT 'unvalidated',
  ADD COLUMN "validation_reason" TEXT,
  ADD COLUMN "validation_confidence" DECIMAL(4,3),
  ADD COLUMN "validated_at" TIMESTAMPTZ(6);
