-- Cases can originate from a chatbot handoff (which may have no screening
-- session), so session_id becomes optional and a case can link to the AI
-- conversation it came from.
ALTER TABLE "cases" ALTER COLUMN "session_id" DROP NOT NULL;
ALTER TABLE "cases" ADD COLUMN "conversation_id" UUID;
ALTER TABLE "cases"
  ADD CONSTRAINT "cases_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
