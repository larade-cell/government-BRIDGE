-- Extensions required by the schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "anomaly_flag_type" AS ENUM ('duplicate_submission', 'abnormal_upload_rate', 'suspicious_file', 'impossible_answer_pattern', 'rapid_session_creation', 'other');

-- CreateEnum
CREATE TYPE "anomaly_severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "anomaly_status" AS ENUM ('open', 'reviewing', 'dismissed', 'confirmed');

-- CreateEnum
CREATE TYPE "auth_channel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "case_priority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "case_status" AS ENUM ('new', 'in_progress', 'waiting_on_client', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "classification_source" AS ENUM ('ai', 'user', 'system');

-- CreateEnum
CREATE TYPE "eligibility_outcome" AS ENUM ('likely_eligible', 'may_be_eligible', 'unlikely_eligible', 'needs_more_info');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('email', 'sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "notification_delivery_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- CreateEnum
CREATE TYPE "notification_frequency" AS ENUM ('realtime', 'daily_digest', 'weekly_digest', 'important_only');

-- CreateEnum
CREATE TYPE "recommendation_status" AS ENUM ('pending', 'viewed', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "recommendation_target_type" AS ENUM ('program', 'organization', 'knowledge_source');

-- CreateEnum
CREATE TYPE "referral_status" AS ENUM ('draft', 'sent', 'accepted', 'closed');

-- CreateEnum
CREATE TYPE "search_target_type" AS ENUM ('program', 'knowledge_source');

-- CreateEnum
CREATE TYPE "upload_status" AS ENUM ('uploaded', 'ocr_pending', 'ocr_complete', 'failed', 'deleted');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('resident', 'navigator', 'caseworker', 'admin');

-- CreateTable
CREATE TABLE "addresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "raw_input" TEXT NOT NULL,
    "normalized_address" JSONB,
    "verification_provider" TEXT,
    "verification_status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "language_code" TEXT DEFAULT 'en',
    "human_handoff_requested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_option_translations" (
    "option_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "answer_option_translations_pkey" PRIMARY KEY ("option_id","language_code")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "option_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "session_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "before_value" JSONB,
    "after_value" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefit_estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "min_amount" DECIMAL(10,2),
    "max_amount" DECIMAL(10,2),
    "period" TEXT,
    "disclaimer" TEXT NOT NULL DEFAULT 'Estimate only. Final benefit amount is determined by the administering agency.',
    "calculation_details" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benefit_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "case_id" UUID NOT NULL,
    "author_id" UUID,
    "note" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "assigned_to" UUID,
    "status" "case_status" NOT NULL DEFAULT 'new',
    "priority" "case_priority" DEFAULT 'normal',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_type_translations" (
    "document_type_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "examples" TEXT,

    CONSTRAINT "document_type_translations_pkey" PRIMARY KEY ("document_type_id","language_code")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doc_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_uploads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "document_type_id" UUID,
    "predicted_document_type_id" UUID,
    "classification_confidence" DECIMAL(4,3),
    "classified_by" "classification_source",
    "classified_at" TIMESTAMPTZ(6),
    "file_name" TEXT NOT NULL,
    "file_mime_type" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "status" "upload_status" NOT NULL DEFAULT 'uploaded',
    "ocr_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "outcome" "eligibility_outcome" NOT NULL,
    "priority_rank" INTEGER NOT NULL,
    "explanation" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligibility_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eligibility_rule_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "rules_json" JSONB NOT NULL,
    "false_positive_bias" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eligibility_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID,
    "title" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "language_code" TEXT DEFAULT 'en',
    "content_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "life_event_translations" (
    "life_event_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "life_event_translations_pkey" PRIMARY KEY ("life_event_id","language_code")
);

-- CreateTable
CREATE TABLE "life_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_key" TEXT NOT NULL,

    CONSTRAINT "life_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigator_clients" (
    "navigator_user_id" UUID NOT NULL,
    "client_user_id" UUID NOT NULL,
    "consent_granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consent_revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "navigator_clients_pkey" PRIMARY KEY ("navigator_user_id","client_user_id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_event_id" UUID,
    "user_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "delivery_status" "notification_delivery_status" NOT NULL,
    "provider_message_id" TEXT,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "destination" TEXT NOT NULL,
    "language_code" TEXT DEFAULT 'en',
    "frequency" "notification_frequency" NOT NULL DEFAULT 'important_only',
    "opted_in" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "organization_type" TEXT NOT NULL,
    "phone" TEXT,
    "email" CITEXT,
    "website_url" TEXT,
    "address" JSONB,
    "service_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_document_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "condition_json" JSONB DEFAULT '{}',
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "program_document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_life_events" (
    "program_id" UUID NOT NULL,
    "life_event_id" UUID NOT NULL,

    CONSTRAINT "program_life_events_pkey" PRIMARY KEY ("program_id","life_event_id")
);

-- CreateTable
CREATE TABLE "program_translations" (
    "program_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "next_steps" TEXT NOT NULL,

    CONSTRAINT "program_translations_pkey" PRIMARY KEY ("program_id","language_code")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "program_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "authoritative_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_dependencies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "depends_on_question_id" UUID NOT NULL,
    "condition_json" JSONB NOT NULL,

    CONSTRAINT "question_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_translations" (
    "question_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helper_text" TEXT,

    CONSTRAINT "question_translations_pkey" PRIMARY KEY ("question_id","language_code")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_key" TEXT NOT NULL,
    "answer_type" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "branching_config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "organization_id" UUID,
    "need_category" TEXT NOT NULL,
    "status" "referral_status" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resume_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "channel" "auth_channel" NOT NULL,
    "destination" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "answer_value" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "screening_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "preferred_language" TEXT DEFAULT 'en',
    "current_step" INTEGER DEFAULT 0,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,
    "fingerprint_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "screening_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_document_checklist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "program_id" UUID,
    "document_type_id" UUID NOT NULL,
    "reason" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_document_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT,
    "phone" TEXT,
    "preferred_language" TEXT DEFAULT 'en',
    "role" "user_role" NOT NULL DEFAULT 'resident',
    "auth_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "target_type" "recommendation_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "rationale" TEXT,
    "score" DECIMAL(4,3),
    "model_name" TEXT,
    "status" "recommendation_status" NOT NULL DEFAULT 'pending',
    "viewed_at" TIMESTAMPTZ(6),
    "accepted_at" TIMESTAMPTZ(6),
    "dismissed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "flag_type" "anomaly_flag_type" NOT NULL,
    "severity" "anomaly_severity" NOT NULL DEFAULT 'low',
    "status" "anomaly_status" NOT NULL DEFAULT 'open',
    "detector" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_classifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_upload_id" UUID NOT NULL,
    "document_type_id" UUID,
    "confidence" DECIMAL(4,3),
    "classified_by" "classification_source" NOT NULL,
    "model_name" TEXT,
    "corrected_by_user_id" UUID,
    "raw_response" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "search_target_type" NOT NULL,
    "target_id" UUID NOT NULL,
    "language_code" TEXT NOT NULL,
    "content_text" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID,
    "user_id" UUID,
    "query_text" TEXT NOT NULL,
    "language_code" TEXT,
    "result_count" INTEGER,
    "selected_target_type" "search_target_type",
    "selected_target_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_synonyms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "language_code" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "answer_options_question_id_option_key_key" ON "answer_options"("question_id", "option_key");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_doc_key_key" ON "document_types"("doc_key");

-- CreateIndex
CREATE INDEX "idx_results_session" ON "eligibility_results"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_results_session_id_program_id_key" ON "eligibility_results"("session_id", "program_id");

-- CreateIndex
CREATE INDEX "idx_rule_versions_program" ON "eligibility_rule_versions"("program_id");

-- CreateIndex
CREATE INDEX "idx_rule_versions_rules" ON "eligibility_rule_versions" USING GIN ("rules_json");

-- CreateIndex
CREATE UNIQUE INDEX "eligibility_rule_versions_program_id_version_key" ON "eligibility_rule_versions"("program_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "life_events_event_key_key" ON "life_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_destination_key" ON "notification_preferences"("user_id", "channel", "destination");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_session_id_channel_destination_key" ON "notification_preferences"("session_id", "channel", "destination");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "program_document_requirements_program_id_document_type_id_key" ON "program_document_requirements"("program_id", "document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "programs_program_key_key" ON "programs"("program_key");

-- CreateIndex
CREATE INDEX "programs_search_vector_idx" ON "programs" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "questions_question_key_key" ON "questions"("question_key");

-- CreateIndex
CREATE INDEX "idx_resume_tokens_hash" ON "resume_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "idx_screening_answers_session" ON "screening_answers"("session_id");

-- CreateIndex
CREATE INDEX "idx_screening_answers_value" ON "screening_answers" USING GIN ("answer_value");

-- CreateIndex
CREATE UNIQUE INDEX "screening_answers_session_id_question_id_key" ON "screening_answers"("session_id", "question_id");

-- CreateIndex
CREATE INDEX "screening_sessions_fingerprint_hash_idx" ON "screening_sessions"("fingerprint_hash");

-- CreateIndex
CREATE UNIQUE INDEX "session_document_checklist_session_id_program_id_document_t_key" ON "session_document_checklist"("session_id", "program_id", "document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE INDEX "ai_recommendations_session_id_status_idx" ON "ai_recommendations"("session_id", "status");

-- CreateIndex
CREATE INDEX "ai_recommendations_target_type_target_id_idx" ON "ai_recommendations"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_recommendations_session_id_target_type_target_id_key" ON "ai_recommendations"("session_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "anomaly_flags_session_id_idx" ON "anomaly_flags"("session_id");

-- CreateIndex
CREATE INDEX "anomaly_flags_status_severity_created_at_idx" ON "anomaly_flags"("status", "severity", "created_at" DESC);

-- CreateIndex
CREATE INDEX "anomaly_flags_payload_idx" ON "anomaly_flags" USING GIN ("payload");

-- CreateIndex
CREATE INDEX "document_classifications_document_upload_id_created_at_idx" ON "document_classifications"("document_upload_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "search_embeddings_target_type_language_code_idx" ON "search_embeddings"("target_type", "language_code");

-- CreateIndex
CREATE UNIQUE INDEX "search_embeddings_target_type_target_id_language_code_embed_key" ON "search_embeddings"("target_type", "target_id", "language_code", "embedding_model");

-- CreateIndex
CREATE INDEX "search_queries_session_id_idx" ON "search_queries"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_synonyms_language_code_term_key" ON "search_synonyms"("language_code", "term");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "answer_option_translations" ADD CONSTRAINT "answer_option_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "answer_option_translations" ADD CONSTRAINT "answer_option_translations_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "answer_options"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "benefit_estimates" ADD CONSTRAINT "benefit_estimates_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "benefit_estimates" ADD CONSTRAINT "benefit_estimates_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_type_translations" ADD CONSTRAINT "document_type_translations_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_type_translations" ADD CONSTRAINT "document_type_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_predicted_document_type_id_fkey" FOREIGN KEY ("predicted_document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_uploads" ADD CONSTRAINT "document_uploads_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "eligibility_rule_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "eligibility_rule_versions" ADD CONSTRAINT "eligibility_rule_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "eligibility_rule_versions" ADD CONSTRAINT "eligibility_rule_versions_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "life_event_translations" ADD CONSTRAINT "life_event_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "life_event_translations" ADD CONSTRAINT "life_event_translations_life_event_id_fkey" FOREIGN KEY ("life_event_id") REFERENCES "life_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "navigator_clients" ADD CONSTRAINT "navigator_clients_client_user_id_fkey" FOREIGN KEY ("client_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "navigator_clients" ADD CONSTRAINT "navigator_clients_navigator_user_id_fkey" FOREIGN KEY ("navigator_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_event_id_fkey" FOREIGN KEY ("notification_event_id") REFERENCES "notification_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_document_requirements" ADD CONSTRAINT "program_document_requirements_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_document_requirements" ADD CONSTRAINT "program_document_requirements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_life_events" ADD CONSTRAINT "program_life_events_life_event_id_fkey" FOREIGN KEY ("life_event_id") REFERENCES "life_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_life_events" ADD CONSTRAINT "program_life_events_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_translations" ADD CONSTRAINT "program_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "program_translations" ADD CONSTRAINT "program_translations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "question_dependencies" ADD CONSTRAINT "question_dependencies_depends_on_question_id_fkey" FOREIGN KEY ("depends_on_question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "question_dependencies" ADD CONSTRAINT "question_dependencies_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resume_tokens" ADD CONSTRAINT "fk_resume_session" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screening_answers" ADD CONSTRAINT "screening_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screening_answers" ADD CONSTRAINT "screening_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screening_sessions" ADD CONSTRAINT "screening_sessions_preferred_language_fkey" FOREIGN KEY ("preferred_language") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "screening_sessions" ADD CONSTRAINT "screening_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session_document_checklist" ADD CONSTRAINT "session_document_checklist_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session_document_checklist" ADD CONSTRAINT "session_document_checklist_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "session_document_checklist" ADD CONSTRAINT "session_document_checklist_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_preferred_language_fkey" FOREIGN KEY ("preferred_language") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anomaly_flags" ADD CONSTRAINT "anomaly_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_corrected_by_user_id_fkey" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_upload_id_fkey" FOREIGN KEY ("document_upload_id") REFERENCES "document_uploads"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_embeddings" ADD CONSTRAINT "search_embeddings_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "screening_sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_synonyms" ADD CONSTRAINT "search_synonyms_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- HNSW index for semantic search over embedding column
CREATE INDEX IF NOT EXISTS "search_embeddings_embedding_hnsw_idx"
  ON "search_embeddings" USING hnsw ("embedding" vector_cosine_ops);
