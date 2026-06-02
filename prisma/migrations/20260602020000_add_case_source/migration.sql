-- Explicit, durable origin for a case ("screening" = results "Request help",
-- "chatbot" = chat assistant handoff). Previously derived from conversation_id,
-- which is fragile because that FK is nulled if the conversation is deleted.
ALTER TABLE "cases" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'screening';

-- Backfill existing rows from their conversation link.
UPDATE "cases" SET "source" = 'chatbot' WHERE "conversation_id" IS NOT NULL;

-- Remove contentless orphan cases (test artifacts: no session, no conversation,
-- and no contact — nothing a caseworker can act on).
DELETE FROM "cases"
WHERE "session_id" IS NULL
  AND "conversation_id" IS NULL
  AND "contact_name" IS NULL
  AND "contact_email" IS NULL
  AND "contact_phone" IS NULL;
