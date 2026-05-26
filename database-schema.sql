# database-schema.sql

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE eligibility_outcome AS ENUM (
  'likely_eligible',
  'may_be_eligible',
  'unlikely_eligible',
  'needs_more_info'
);

CREATE TYPE auth_channel AS ENUM ('email', 'sms');

CREATE TYPE upload_status AS ENUM (
  'uploaded',
  'ocr_pending',
  'ocr_complete',
  'failed',
  'deleted'
);

CREATE TYPE notification_channel AS ENUM (
  'email',
  'sms',
  'whatsapp'
);

CREATE TYPE referral_status AS ENUM (
  'draft',
  'sent',
  'accepted',
  'closed'
);

CREATE TYPE user_role AS ENUM (
  'resident',
  'navigator',
  'caseworker',
  'admin'
);

-- =====================================================
-- LANGUAGES
-- =====================================================

CREATE TABLE languages (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO languages (code, name)
VALUES
  ('en', 'English'),
  ('es', 'Spanish');

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE,
  phone TEXT UNIQUE,
  preferred_language TEXT REFERENCES languages(code) DEFAULT 'en',
  role user_role NOT NULL DEFAULT 'resident',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resume_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  channel auth_channel NOT NULL,
  destination TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_resume_tokens_hash
  ON resume_tokens(token_hash);

-- =====================================================
-- SCREENING SESSIONS
-- =====================================================

CREATE TABLE screening_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  preferred_language TEXT REFERENCES languages(code) DEFAULT 'en',
  current_step INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE resume_tokens
ADD CONSTRAINT fk_resume_session
FOREIGN KEY (session_id)
REFERENCES screening_sessions(id)
ON DELETE CASCADE;

-- =====================================================
-- QUESTIONS
-- =====================================================

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key TEXT UNIQUE NOT NULL,
  answer_type TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT true,
  branching_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_translations (
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  language_code TEXT REFERENCES languages(code),
  prompt TEXT NOT NULL,
  helper_text TEXT,
  PRIMARY KEY (question_id, language_code)
);

CREATE TABLE answer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  value JSONB NOT NULL,
  display_order INTEGER NOT NULL,
  UNIQUE (question_id, option_key)
);

CREATE TABLE answer_option_translations (
  option_id UUID REFERENCES answer_options(id) ON DELETE CASCADE,
  language_code TEXT REFERENCES languages(code),
  label TEXT NOT NULL,
  PRIMARY KEY (option_id, language_code)
);

CREATE TABLE question_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  depends_on_question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  condition_json JSONB NOT NULL
);

-- =====================================================
-- SCREENING ANSWERS
-- =====================================================

CREATE TABLE screening_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  answer_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);

CREATE INDEX idx_screening_answers_session
  ON screening_answers(session_id);

CREATE INDEX idx_screening_answers_value
  ON screening_answers USING GIN(answer_value);

-- =====================================================
-- PROGRAMS & RULES ENGINE
-- =====================================================

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  authoritative_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE program_translations (
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  language_code TEXT REFERENCES languages(code),
  name TEXT NOT NULL,
  short_description TEXT NOT NULL,
  next_steps TEXT NOT NULL,
  PRIMARY KEY (program_id, language_code)
);

CREATE TABLE eligibility_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  rules_json JSONB NOT NULL,
  false_positive_bias BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, version)
);

CREATE INDEX idx_rule_versions_program
  ON eligibility_rule_versions(program_id);

CREATE INDEX idx_rule_versions_rules
  ON eligibility_rule_versions USING GIN(rules_json);

CREATE TABLE eligibility_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id),
  rule_version_id UUID NOT NULL REFERENCES eligibility_rule_versions(id),
  outcome eligibility_outcome NOT NULL,
  priority_rank INTEGER NOT NULL,
  explanation JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, program_id)
);

CREATE INDEX idx_results_session
  ON eligibility_results(session_id);

-- =====================================================
-- DOCUMENTS & UPLOADS
-- =====================================================

CREATE TABLE document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_key TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE document_type_translations (
  document_type_id UUID REFERENCES document_types(id) ON DELETE CASCADE,
  language_code TEXT REFERENCES languages(code),
  name TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY (document_type_id, language_code)
);

CREATE TABLE program_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  condition_json JSONB DEFAULT '{}'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (program_id, document_type_id)
);

CREATE TABLE session_document_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  document_type_id UUID NOT NULL REFERENCES document_types(id),
  reason JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, program_id, document_type_id)
);

CREATE TABLE document_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  document_type_id UUID REFERENCES document_types(id),
  file_name TEXT NOT NULL,
  file_mime_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  status upload_status NOT NULL DEFAULT 'uploaded',
  ocr_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- AI NAVIGATOR
-- =====================================================

CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id),
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  language_code TEXT REFERENCES languages(code) DEFAULT 'en',
  content_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES screening_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  language_code TEXT REFERENCES languages(code) DEFAULT 'en',
  human_handoff_requested BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES screening_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  destination TEXT NOT NULL,
  language_code TEXT REFERENCES languages(code) DEFAULT 'en',
  frequency TEXT NOT NULL DEFAULT 'important_only',
  opted_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id UUID REFERENCES notification_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  delivery_status TEXT NOT NULL,
  provider_message_id TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- ORGANIZATIONS & REFERRALS
-- =====================================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  phone TEXT,
  email CITEXT,
  website_url TEXT,
  address JSONB,
  service_categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  need_category TEXT NOT NULL,
  status referral_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PROGRAM DISCOVERY
-- =====================================================

CREATE TABLE life_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE NOT NULL
);

CREATE TABLE life_event_translations (
  life_event_id UUID REFERENCES life_events(id) ON DELETE CASCADE,
  language_code TEXT REFERENCES languages(code),
  label TEXT NOT NULL,
  PRIMARY KEY (life_event_id, language_code)
);

CREATE TABLE program_life_events (
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  life_event_id UUID REFERENCES life_events(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, life_event_id)
);

-- =====================================================
-- ADDRESS VERIFICATION
-- =====================================================

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES screening_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  raw_input TEXT NOT NULL,
  normalized_address JSONB,
  verification_provider TEXT,
  verification_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- TRUSTED INTERMEDIARY / NAVIGATOR SUPPORT
-- =====================================================

CREATE TABLE navigator_clients (
  navigator_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consent_revoked_at TIMESTAMPTZ,
  PRIMARY KEY (navigator_user_id, client_user_id)
);

-- =====================================================
-- CASEWORKER DASHBOARD
-- =====================================================

CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id),
  note TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- BENEFIT ESTIMATES
-- =====================================================

CREATE TABLE benefit_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id),
  min_amount NUMERIC(10,2),
  max_amount NUMERIC(10,2),
  period TEXT,
  disclaimer TEXT NOT NULL DEFAULT 'Estimate only. Final benefit amount is determined by the administering agency.',
  calculation_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES screening_sessions(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_value JSONB,
  after_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor
  ON audit_logs(actor_user_id);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

-- =====================================================
-- AUTHENTICATION & AUTHORIZATION API ENDPOINTS
-- =====================================================

/*
POST /auth/magic-link/request
POST /auth/magic-link/verify
POST /auth/logout
GET  /auth/me

GET    /auth/permissions
POST   /auth/roles/assign
DELETE /auth/roles/remove
*/
```
