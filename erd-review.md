# ERD Review vs User Stories

Reviewed: 2026-05-27. Schema source: `prisma/schema.prisma`. Stories source: `user-stories.md`.

For each story I checked whether the tables, fields, relations, and constraints needed to deliver every acceptance criterion exist. Result is one of:

- ✅ **Covered** — schema is sufficient.
- ⚠️ **Gap (schema)** — a field, table, or relation needs adding/changing.
- 🟡 **Gap (deferred)** — known shortfall, acceptable for MVP given priority.
- ☐ **App-layer only** — schema is fine; story is implementation work.

---

## Story-by-story

| # | Story | Priority | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | Anonymous screening session | Must | ✅ | `screening_sessions.user_id` is nullable; `expires_at` supports temporary; no SSN field exists. |
| 2 | Save and resume | Must | ✅ | `resume_tokens` (session_id, channel, destination, token_hash, expires_at, used_at) covers it. |
| 3 | Language preference | Should | ✅ | `screening_sessions.preferred_language` + translation tables for every user-facing entity. |
| 4 | Optional account creation | Nice | ☐ | Schema fine; `screening_sessions.user_id` is nullable so anonymous sessions can be claimed later via UPDATE. |
| 5 | Complete screener | Must | ✅ | `questions`, `answer_options`, `question_dependencies`, `screening_answers`, `current_step`. |
| 6 | Multi-program screening | Must | ✅ | `eligibility_rule_versions` per program + `eligibility_results` unique on (session_id, program_id). |
| 7 | View results | Must | ✅ | `eligibility_outcome` enum has all four categories; `programs.authoritative_url`; `program_translations.next_steps`. |
| 8 | Personalised checklist | Must | ⚠️ | **Missing `examples` on `document_type_translations`.** Acceptance criterion: "Items include descriptions and examples." |
| 9 | Upload supporting docs | Should | ☐ | Schema fine. MIME-type allowlist enforced at API layer. Storage provider (UploadThing/S3) is a separate decision. |
| 10 | Browse by category | Should | ✅ | `programs.category` + `life_events` + `program_life_events`. |
| 11 | Community referrals | Should | ✅ | `organizations` + `referrals`. Human-handoff via `ai_conversations.human_handoff_requested`. |
| 12 | Manage notifications | Should | ✅ | `notification_preferences` (channel, destination, language_code, frequency, opted_in). |
| 13 | AI chatbot | Must | ✅ | `ai_conversations`, `ai_messages` (with `citations` JSON), `human_handoff_requested`. |
| 14 | Smart program search | Should | ⚠️ | **No embedding column or full-text index on `programs`.** Need either `pgvector` (`embedding vector(1536)`) for semantic search, or `tsvector` for keyword search. |
| 15 | AI document classification | Should | ⚠️ | **Missing `classification_confidence` and `predicted_document_type_id` on `document_uploads`.** Acceptance criterion: "Classification confidence is logged." |
| 16 | AI recommendations | Should | 🟡 | No dedicated `recommendations` table. Defer: existing `eligibility_results` + `referrals` cover the "what is recommended" part. "Ignore" state can live in app session storage or a thin new table later. |
| 17 | Anomaly detection | Nice | 🟡 | No `flagged_events` table. Defer: `audit_logs` can absorb this with a `severity` field if/when this story is picked up. |
| 18 | Caseworker dashboard | Must | ✅ | `cases` + `case_notes` + `user_roles`. |
| 20 | Manage eligibility rules | Should | ✅ | `eligibility_rule_versions` has version, rules_json, effective_from/to, created_by. |

---

## Required schema changes (Phase 1 — fix before Phase 2 implementation)

### 1. `document_type_translations.examples`

Story 8 requires document checklist items to include examples (e.g. "Last 30 days of pay stubs, or a recent W-2"). Add:

```prisma
model document_type_translations {
  ...
  examples String?
}
```

### 2. `document_uploads.classification_*`

Story 15 requires logging AI classification confidence and the predicted type (separate from the user-confirmed type). Add:

```prisma
model document_uploads {
  ...
  predicted_document_type_id String?  @db.Uuid
  classification_confidence  Decimal? @db.Decimal(4, 3)  // 0.000–1.000
}
```

The user-confirmed type stays in `document_type_id` so the existing FK relationships continue to work.

### 3. Search support on `programs`

Story 14 requires natural-language program search. Two viable options:

- **Full-text search (simpler, no extra extension).** Add `search_vector tsvector` and a GIN index. Populate via trigger or app-side.
- **Semantic search (matches AI integration plan).** Add `embedding vector(1536)` plus pgvector extension. More setup but matches the AI direction.

Recommended for MVP: start with **full-text** since you can build it today without extensions, and layer embeddings in later when the AI feature lands.

```prisma
model programs {
  ...
  search_vector Unsupported("tsvector")?
  @@index([search_vector], type: Gin)
}
```

---

## Deferred (acceptable as-is)

- **Story 16 (Recommendations)**: defer the dedicated `recommendations` table; lean on `eligibility_results` + `referrals` for MVP.
- **Story 17 (Anomaly detection)**: Nice-priority, defer entirely. Revisit if scope allows.

---

## Tables in schema not used by any story

For audit only — not necessarily problems:

- `addresses` — not in user stories but useful infrastructure.
- `permissions`, `roles`, `role_permissions`, `user_roles` — RBAC framework. Used by Story 18 (caseworker) and 20 (admin) indirectly.
- `notification_events`, `notification_deliveries` — delivery audit, supports Story 12.
- `user_sessions` — overlaps with NextAuth's `Session` table; redundant. Consider removing once we're sure NextAuth covers all session needs.
- `knowledge_sources` — supports Story 13 (chatbot citations).

---

## Verdict

**The schema covers ~15 of 18 stories with no changes.** Three specific gaps (Stories 8, 14, 15) need schema work before implementation. None are blockers for today's screening-core CRUD slice — we can implement Stories 1, 2, 5, 6, 7 immediately and circle back to 8/14/15 when their features come up.
