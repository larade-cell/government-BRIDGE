# BRIDGE API Specification

Detailed reference for every user-facing endpoint. Each resource section lists routes, query parameters, request and response schemas, and the typical example payloads. See [`api-routes.md`](../api-routes.md) at the repo root for the higher-level status table mapping REST routes to tRPC procedures.

> **Implementation note.** Routes below are documented in REST shape for clarity. The actual implementation is tRPC procedures under `/api/trpc/<router>.<procedure>` (one-to-one mapping). REST paths are aspirational and used to communicate resource modeling.

---

## 1. Conventions

### 1.1 Base URL and versioning

```
/api/v1
```

Breaking changes ship under `/api/v2`. Additive changes go to `v1`.

### 1.2 Field naming

API payloads use `camelCase`. The database is `snake_case` (Prisma introspected). The API layer translates at the boundary.

### 1.3 Authentication

| Caller | Mechanism |
|---|---|
| Anonymous resident | None. Session id functions as a bearer token for sessions where `userId` is null. |
| Authenticated user | NextAuth session cookie. The server resolves `appUserId` from `auth_user_id` on every request. |
| Service-to-service | Out of scope for v1. |

Authentication state is described per-route as:

- **Public** — no auth required.
- **Public, session-scoped** — no account required, but the caller must present a valid `sessionId` in the URL. If the session has been claimed by a user, ownership is enforced.
- **Authenticated** — requires a NextAuth session.
- **Role-gated** — additionally requires a specific role (`navigator`, `caseworker`, `admin`).

### 1.4 Pagination

List endpoints accept:

| Query param | Type | Default | Description |
|---|---|---|---|
| `limit` | integer (1-100) | 20 | Page size |
| `offset` | integer (≥0) | 0 | Row offset |

Responses include a `meta` object:

```json
{
  "data": [ /* ... */ ],
  "meta": {
    "limit": 20,
    "offset": 0,
    "total": 137
  }
}
```

### 1.5 Sorting

```
?sort=createdAt        # ascending
?sort=-createdAt       # descending
?sort=-priority,name   # multi-key, comma-separated
```

Each resource lists its supported sort keys.

### 1.6 Filtering

Simple equality filters use flat query params:

```
?status=draft
?language=en
```

Composite or operator filters use bracket syntax (JSON:API style):

```
?filter[createdAfter]=2026-01-01T00:00:00Z
?filter[outcome][in]=likely_eligible,may_be_eligible
```

### 1.7 Relationship expansion

```
?include=program,answers
?include=program.translations
```

Comma-separated relation names. Nested relations use dot notation. Each resource lists the relations it supports expanding.

### 1.8 Internationalization

Translated content is selected by `?language=en|es`. The default is the caller's session `preferredLanguage`, falling back to `en`. Responses include the resolved language in `meta.language`.

### 1.9 Error format

All error responses share this shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Session belongs to another user",
    "details": { /* optional, error-specific */ }
  }
}
```

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Validation failure, business-rule violation |
| 401 | `UNAUTHORIZED` | No or invalid auth |
| 403 | `FORBIDDEN` | Authenticated but not authorized |
| 404 | `NOT_FOUND` | Resource missing |
| 409 | `CONFLICT` | Unique constraint or state conflict |
| 422 | `UNPROCESSABLE` | Well-formed request but semantically invalid (e.g., expired session) |
| 429 | `RATE_LIMITED` | Throttle hit |
| 500 | `INTERNAL` | Unhandled server error |

### 1.10 Common request headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | yes (writes) | `application/json` |
| `Accept-Language` | no | Hint; per-request `?language=` always wins |
| `Idempotency-Key` | no | For `POST`s; replays return the original response within 24h |

---

## 2. Resources

### 2.1 Screening Sessions

The root resource for the screening flow. Created anonymously; optionally claimed by an account later. The id functions as a bearer token until claimed.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/screening-sessions` | Public | Start a new session |
| `GET` | `/screening-sessions/:sessionId` | Public, session-scoped | Read a session and its answers |
| `PATCH` | `/screening-sessions/:sessionId` | Public, session-scoped | Update language or claim the session |
| `POST` | `/screening-sessions/:sessionId/complete` | Public, session-scoped | Mark the session completed |
| `GET` | `/screening-sessions` | Authenticated | List the caller's claimed sessions |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Server-assigned |
| `userId` | uuid \| null | no | Set when claimed by an account |
| `preferredLanguage` | string | no | ISO 639-1; default `en` |
| `currentStep` | integer | no | Default 0 |
| `completedAt` | datetime \| null | no | Set by `/complete` |
| `expiresAt` | datetime | no | Default 30 days from creation |
| `createdAt` | datetime | yes | Server-set |
| `updatedAt` | datetime | yes | Server-set |

#### `POST /screening-sessions`

Request body (all optional):

```json
{
  "preferredLanguage": "en"
}
```

Response 201:

```json
{
  "id": "9f7c1c3a-...",
  "preferredLanguage": "en",
  "currentStep": 0,
  "expiresAt": "2026-06-27T13:14:15.000Z",
  "createdAt": "2026-05-28T13:14:15.000Z"
}
```

#### `GET /screening-sessions/:sessionId`

| Query param | Type | Description |
|---|---|---|
| `include` | string | `answers`, `eligibilityResults`, `checklist` |
| `language` | string | Influences any included translated content |

Response 200 includes the schema above plus expanded relations when requested.

#### `PATCH /screening-sessions/:sessionId`

Body (any subset):

```json
{
  "preferredLanguage": "es",
  "currentStep": 3
}
```

Claiming a session (must be authenticated and the session must be currently anonymous):

```json
{ "claim": true }
```

Server sets `userId` to the caller's `appUserId`.

#### `GET /screening-sessions` (authenticated)

| Query | Type | Default | Description |
|---|---|---|---|
| `limit`, `offset` | — | — | Pagination |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt`, `completedAt`, `-completedAt` |
| `filter[completed]` | boolean | — | `true` returns only completed |

---

### 2.2 Questions

Reference content for the screener. Reads are public; mutations are admin-only.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/questions` | Public | List all questions, ordered by `displayOrder` |
| `GET` | `/questions/:questionId` | Public | Fetch a single question |
| `POST` | `/questions` | Role-gated (admin) | Create |
| `PATCH` | `/questions/:questionId` | Role-gated (admin) | Update |
| `DELETE` | `/questions/:questionId` | Role-gated (admin) | Soft-delete (not yet wired in schema; placeholder) |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `questionKey` | string | yes | Stable identifier for branching logic |
| `answerType` | enum | yes | `boolean`, `integer`, `decimal`, `single_select`, `multi_select`, `text`, `date` |
| `displayOrder` | integer | yes |  |
| `isRequired` | boolean | no | Default `true` |
| `branchingConfig` | object | no | Free-form JSON consumed by branching engine |
| `prompt` | string | yes | Translated for `?language=` |
| `helperText` | string \| null | no | Translated |
| `options` | AnswerOption[] | conditional | Required when `answerType` is `*_select` |

`AnswerOption`:

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `optionKey` | string | yes |  |
| `value` | any | yes | The value persisted into `screeningAnswers.answerValue` |
| `displayOrder` | integer | yes |  |
| `label` | string | yes | Translated |

#### `GET /questions`

| Query | Type | Default | Description |
|---|---|---|---|
| `language` | string | session default | `en` or `es` |
| `include` | string | — | `dependencies` |

Response:

```json
{
  "data": [
    {
      "id": "q1-uuid",
      "questionKey": "household_size",
      "answerType": "integer",
      "displayOrder": 1,
      "isRequired": true,
      "branchingConfig": {},
      "prompt": "How many people live in your household, including you?",
      "helperText": null,
      "options": []
    }
  ],
  "meta": { "language": "en" }
}
```

---

### 2.3 Screening Answers

Per-question responses scoped to a session.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/screening-sessions/:sessionId/answers` | Public, session-scoped | List answers for a session |
| `PUT` | `/screening-sessions/:sessionId/answers/:questionId` | Public, session-scoped | Upsert an answer |
| `DELETE` | `/screening-sessions/:sessionId/answers/:questionId` | Public, session-scoped | Remove an answer |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `questionId` | uuid | yes |  |
| `answerValue` | any | yes | Type matches `question.answerType` |
| `createdAt`, `updatedAt` | datetime | yes |  |

#### `PUT /screening-sessions/:sessionId/answers/:questionId`

Body:

```json
{ "answerValue": 4 }
```

Server validates against the referenced question's `answerType`. Returns the upserted row.

`422 UNPROCESSABLE` if the session is expired or `completedAt` is set.

---

### 2.4 Programs

The catalog of benefit programs. Reads are public; mutations are admin-only.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/programs` | Public | Browse programs |
| `GET` | `/programs/:programId` | Public | Get one program |
| `POST` | `/programs` | Role-gated (admin) | Create |
| `PATCH` | `/programs/:programId` | Role-gated (admin) | Update |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `programKey` | string | yes | Stable identifier (`snap`, `wic`, `medicaid`, ...) |
| `category` | string | yes | `food`, `healthcare`, `housing`, `energy`, ... |
| `authoritativeUrl` | url | yes | Official program page |
| `isActive` | boolean | no | Default `true` |
| `name` | string | yes | Translated |
| `shortDescription` | string | yes | Translated |
| `nextSteps` | string | yes | Translated |
| `lifeEvents` | string[] | no | Tags from `lifeEvents`, included when `?include=lifeEvents` |

#### `GET /programs`

| Query | Type | Default | Description |
|---|---|---|---|
| `language` | string | session default |  |
| `filter[category]` | string | — | `food`, `healthcare`, ... |
| `filter[isActive]` | boolean | `true` |  |
| `filter[lifeEvent]` | string | — | Match `lifeEvents.eventKey` |
| `sort` | string | `name` | `name`, `-name`, `category` |
| `include` | string | — | `lifeEvents`, `documentRequirements` |
| `limit`, `offset` | — | — |  |

---

### 2.5 Eligibility Results

Outcome of running the rule engine against a session. One row per program.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/screening-sessions/:sessionId/eligibility/run` | Public, session-scoped | Evaluate all active programs |
| `GET` | `/screening-sessions/:sessionId/eligibility-results` | Public, session-scoped | List results |
| `GET` | `/screening-sessions/:sessionId/eligibility-results/:resultId` | Public, session-scoped | Get one |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `programId` | uuid | yes |  |
| `ruleVersionId` | uuid | yes | The rule version evaluated |
| `outcome` | enum | yes | `likely_eligible`, `may_be_eligible`, `unlikely_eligible`, `needs_more_info` |
| `priorityRank` | integer | yes | Display order, lower = higher priority |
| `explanation` | object | yes | `{ reasons: string[] }` |
| `program` | Program | no | Expanded with `?include=program` |
| `createdAt` | datetime | yes |  |

#### `POST /screening-sessions/:sessionId/eligibility/run`

Empty body. Response:

```json
{ "count": 6 }
```

Re-running upserts rows in place (per `(sessionId, programId)`).

#### `GET /screening-sessions/:sessionId/eligibility-results`

| Query | Type | Default | Description |
|---|---|---|---|
| `language` | string | session default |  |
| `include` | string | `program` | Comma-separated |
| `filter[outcome]` | string | — | Single or `in:` comma list |
| `sort` | string | `priorityRank` |  |

---

### 2.6 Document Types

Reference catalog of document categories (`paystub`, `ssn_card`, ...). Read-only for clients.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/document-types` | Public | List |
| `GET` | `/document-types/:typeId` | Public | Get one |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `docKey` | string | yes |  |
| `category` | string | yes |  |
| `name` | string | yes | Translated |
| `description` | string \| null | no | Translated |
| `examples` | string \| null | no | Translated; per-item examples ("W-2", "1099") |

---

### 2.7 Session Document Checklist

The personalised checklist of documents the session needs. Generated from `eligibilityResults` and `programDocumentRequirements`.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/screening-sessions/:sessionId/document-checklist` | Public, session-scoped | List checklist items |
| `POST` | `/screening-sessions/:sessionId/document-checklist/generate` | Public, session-scoped | (Re)generate from current eligibility |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `programId` | uuid \| null | no | Null = generic requirement |
| `documentType` | DocumentType | yes | Always expanded |
| `reason` | object | no | `{ rule: string, programKey?: string }` |
| `uploadStatus` | enum | yes | Derived: `missing`, `uploaded`, `verified` (joined via `documentUploads`) |
| `createdAt` | datetime | yes |  |

#### `GET /screening-sessions/:sessionId/document-checklist`

| Query | Type | Default | Description |
|---|---|---|---|
| `language` | string | session default |  |
| `filter[programId]` | uuid | — | Limit to one program |
| `filter[status]` | enum | — | `missing`, `uploaded` |

---

### 2.8 Document Uploads

Files the resident has uploaded. Storage is delegated to an object store; the API returns a signed URL on upload.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/screening-sessions/:sessionId/documents` | Public, session-scoped | Initiate upload, get presigned target |
| `GET` | `/screening-sessions/:sessionId/documents` | Public, session-scoped | List uploads |
| `GET` | `/screening-sessions/:sessionId/documents/:documentId` | Public, session-scoped | Get one (with classifications) |
| `PATCH` | `/screening-sessions/:sessionId/documents/:documentId` | Public, session-scoped | User correction of `documentTypeId` |
| `DELETE` | `/screening-sessions/:sessionId/documents/:documentId` | Public, session-scoped | Mark deleted (sets `status='deleted'`, retains row) |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `documentTypeId` | uuid \| null | no | Confirmed type |
| `predictedDocumentTypeId` | uuid \| null | no | AI prediction |
| `classificationConfidence` | number (0-1) \| null | no |  |
| `classifiedBy` | enum \| null | no | `ai`, `user`, `system` |
| `classifiedAt` | datetime \| null | no |  |
| `fileName` | string | yes |  |
| `fileMimeType` | string | yes | `image/jpeg`, `image/png`, `application/pdf`, `image/heic` |
| `storageUrl` | string | yes | Server-resolved download URL (signed, time-limited) |
| `status` | enum | yes | `uploaded`, `ocr_pending`, `ocr_complete`, `failed`, `deleted` |
| `ocrText` | string \| null | no | OCR-extracted text |
| `createdAt` | datetime | yes |  |

#### `POST /screening-sessions/:sessionId/documents`

Two-step upload: client requests an upload slot, then PUTs the file to the returned `uploadUrl`.

Request:

```json
{
  "fileName": "paystub.pdf",
  "fileMimeType": "application/pdf",
  "size": 184320,
  "documentTypeId": "doc-type-uuid"
}
```

Response 201:

```json
{
  "id": "doc-uuid",
  "uploadUrl": "https://signed.storage/...",
  "uploadHeaders": { "x-amz-meta-session": "session-uuid" },
  "expiresAt": "2026-05-28T13:34:15.000Z"
}
```

After the client PUTs to `uploadUrl`, the storage service notifies the API which transitions `status` to `uploaded` and queues OCR/classification.

---

### 2.9 Users

The authenticated user's own profile. Other users' profiles are not exposed via v1.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/users/me` | Authenticated | Read profile |
| `PATCH` | `/users/me` | Authenticated | Update profile |
| `DELETE` | `/users/me` | Authenticated | Soft-delete the account (out of scope for v1) |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes | Domain `users.id` |
| `authUserId` | uuid | yes | NextAuth `User.id` |
| `email` | string \| null | no |  |
| `phone` | string \| null | no |  |
| `name` | string \| null | no | From NextAuth `User.name` |
| `image` | url \| null | no | From NextAuth `User.image` |
| `preferredLanguage` | string | yes |  |
| `role` | enum | yes | `resident`, `navigator`, `caseworker`, `admin` |
| `createdAt` | datetime | yes |  |

#### `PATCH /users/me`

Any subset of:

```json
{
  "preferredLanguage": "es",
  "phone": "+15551234567"
}
```

Role and email are immutable via this endpoint.

---

### 2.10 Notification Preferences

How a user (or session) wants to be notified.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/notification-preferences` | Authenticated OR session-scoped | List the caller's prefs |
| `PUT` | `/notification-preferences/:preferenceId` | Authenticated OR session-scoped | Upsert |
| `DELETE` | `/notification-preferences/:preferenceId` | Authenticated OR session-scoped | Remove |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid \| null | no | Either `sessionId` OR `userId` must be set |
| `userId` | uuid \| null | no |  |
| `channel` | enum | yes | `email`, `sms`, `whatsapp` |
| `destination` | string | yes | Address or phone in E.164 |
| `languageCode` | string | no | Default `en` |
| `frequency` | enum | yes | `realtime`, `daily_digest`, `weekly_digest`, `important_only` |
| `optedIn` | boolean | yes | Default `true` |
| `createdAt` | datetime | yes |  |

`409 CONFLICT` if a row already exists for `(userId OR sessionId, channel, destination)`.

---

### 2.11 Organizations

Community organizations available for referrals.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/organizations` | Public | List/search |
| `GET` | `/organizations/:orgId` | Public | Get one |
| `POST` | `/organizations` | Role-gated (admin) | Create |
| `PATCH` | `/organizations/:orgId` | Role-gated (admin) | Update |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `name` | string | yes |  |
| `organizationType` | string | yes | `food_bank`, `legal_aid`, `housing`, ... |
| `phone` | string \| null | no |  |
| `email` | string \| null | no |  |
| `websiteUrl` | url \| null | no |  |
| `address` | object \| null | no | `{ street1, street2, city, region, postalCode, country }` |
| `serviceCategories` | string[] | no | Tags, default `[]` |

#### `GET /organizations`

| Query | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Full-text search across `name`, `serviceCategories` |
| `filter[type]` | string | — | `organizationType` |
| `filter[category]` | string | — | Match any tag in `serviceCategories` |
| `filter[postalCode]` | string | — | Five-digit ZIP filter against `address.postalCode` |
| `sort` | string | `name` |  |
| `limit`, `offset` | — | — |  |

---

### 2.12 Referrals

Connections between a session and an organization (or pending in-person help requests with no org yet).

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/referrals` | Public, session-scoped (via `sessionId` in body) | Create |
| `GET` | `/referrals` | Authenticated (own) OR session-scoped | List |
| `GET` | `/referrals/:referralId` | Authenticated/session-scoped | Get one |
| `PATCH` | `/referrals/:referralId` | Role-gated (navigator, caseworker) | Update status / assign org |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `organizationId` | uuid \| null | no | Null when this is an "in-person help" request not yet routed |
| `needCategory` | string | yes | `housing`, `food`, `legal`, `in_person_help`, ... |
| `status` | enum | yes | `draft`, `sent`, `accepted`, `closed`; default `draft` |
| `notes` | string \| null | no |  |
| `sentAt` | datetime \| null | no |  |
| `createdAt` | datetime | yes |  |

---

### 2.13 Life Events (browse)

Tags used to surface relevant programs ("had a baby", "lost a job", ...).

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/life-events` | Public | List with translated labels |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `eventKey` | string | yes |  |
| `label` | string | yes | Translated |

---

### 2.14 AI Conversations and Messages

The chatbot. One conversation per topic; many messages per conversation.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/ai/conversations` | Public, session-scoped (or authenticated) | Start a conversation |
| `GET` | `/ai/conversations` | Authenticated | List own conversations |
| `GET` | `/ai/conversations/:conversationId` | Owner only | Read |
| `POST` | `/ai/conversations/:conversationId/messages` | Owner only | Send a user message; returns the assistant reply |
| `POST` | `/ai/conversations/:conversationId/handoff` | Owner only | Request human handoff |
| `POST` | `/ai/ask` | Public, session-scoped | One-shot ask (stateless variant); creates conversation + first message internally |

#### `Conversation` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid \| null | no |  |
| `userId` | uuid \| null | no |  |
| `languageCode` | string | no | Default `en` |
| `humanHandoffRequested` | boolean | yes | Default `false` |
| `createdAt` | datetime | yes |  |

#### `Message` schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `conversationId` | uuid | yes |  |
| `role` | enum | yes | `user`, `assistant`, `system` |
| `content` | string | yes |  |
| `citations` | Citation[] | no | Default `[]` |
| `createdAt` | datetime | yes |  |

`Citation`:

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes |  |
| `url` | url | yes |  |
| `sourceId` | uuid \| null | no | When citing an indexed `knowledgeSources` row |

#### `POST /ai/ask`

```json
{
  "sessionId": "uuid",
  "question": "Do I qualify for WIC if I am pregnant?",
  "language": "en"
}
```

Response 200:

```json
{
  "conversationId": "uuid",
  "answer": "You may qualify for WIC based on pregnancy status and income. Final eligibility is determined by the administering agency.",
  "citations": [
    { "title": "WIC Eligibility Requirements", "url": "https://example.gov/wic" }
  ],
  "humanHandoffOffered": true
}
```

---

### 2.15 AI Recommendations

Personalised suggestions (additional programs, community resources). Distinct from `eligibilityResults` (deterministic) and `aiConversations` (chat).

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/screening-sessions/:sessionId/recommendations` | Public, session-scoped | List recommendations |
| `POST` | `/recommendations/:recommendationId/dismiss` | Same caller | Set `status='dismissed'`, `dismissedAt=now()` |
| `POST` | `/recommendations/:recommendationId/accept` | Same caller | Set `status='accepted'`, `acceptedAt=now()` |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `userId` | uuid \| null | no |  |
| `targetType` | enum | yes | `program`, `organization`, `knowledge_source` |
| `targetId` | uuid | yes | Polymorphic; resolve via `targetType` |
| `target` | object | no | Expanded with `?include=target` |
| `rationale` | string \| null | no |  |
| `score` | number (0-1) \| null | no | Model confidence |
| `modelName` | string \| null | no |  |
| `status` | enum | yes | `pending`, `viewed`, `accepted`, `dismissed`; default `pending` |
| `viewedAt`, `acceptedAt`, `dismissedAt` | datetime \| null | no |  |
| `createdAt` | datetime | yes |  |

---

### 2.16 Cases (caseworker dashboard)

Open work items derived from sessions that need staff attention.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/cases` | Role-gated (caseworker, admin) | List with filters |
| `GET` | `/cases/:caseId` | Role-gated, caseworker assigned OR admin | Read |
| `PATCH` | `/cases/:caseId` | Role-gated | Update status / assignee / priority |
| `POST` | `/cases/:caseId/assign` | Role-gated | Set `assignedTo` |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `sessionId` | uuid | yes |  |
| `assignedTo` | uuid \| null | no | Domain `users.id` |
| `status` | enum | yes | `new`, `in_progress`, `waiting_on_client`, `resolved`, `closed`; default `new` |
| `priority` | enum | no | `low`, `normal`, `high`, `urgent`; default `normal` |
| `session` | ScreeningSession | no | Expanded with `?include=session` |
| `notes` | CaseNote[] | no | Expanded with `?include=notes` |
| `createdAt`, `updatedAt` | datetime | yes |  |

#### `GET /cases`

| Query | Type | Default | Description |
|---|---|---|---|
| `filter[status]` | enum | — | Single or `in:` list |
| `filter[priority]` | enum | — |  |
| `filter[assignedTo]` | uuid \| `me` \| `unassigned` | — |  |
| `sort` | string | `-priority,-createdAt` |  |
| `limit`, `offset` | — | — |  |

---

### 2.17 Case Notes

Notes attached to a case. Internal notes are not exposed to the resident.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/cases/:caseId/notes` | Role-gated | List notes |
| `POST` | `/cases/:caseId/notes` | Role-gated | Add a note |
| `PATCH` | `/cases/:caseId/notes/:noteId` | Author or admin | Update |
| `DELETE` | `/cases/:caseId/notes/:noteId` | Author or admin | Delete |

#### Resource schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | uuid | yes |  |
| `caseId` | uuid | yes |  |
| `authorId` | uuid \| null | no |  |
| `note` | string | yes |  |
| `isInternal` | boolean | no | Default `true` |
| `createdAt` | datetime | yes |  |

---

### 2.18 Search

Two flavors: scoped GET routes for common cases, and a generic `POST /search` for advanced queries.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/search/programs` | Public | Natural-language search over programs and knowledge sources |
| `GET` | `/search/organizations` | Public | Plain search over organizations |
| `POST` | `/search` | Public | Advanced/structured search |

#### `GET /search/programs`

| Query | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Natural-language query |
| `language` | string | session default | Restricts which embeddings to search |
| `limit` | integer | 10 | Max 50 |

Response:

```json
{
  "data": [
    {
      "targetType": "program",
      "targetId": "uuid",
      "score": 0.84,
      "snippet": "SNAP helps low-income households buy groceries...",
      "program": { "/* embedded summary */": "" }
    }
  ],
  "meta": { "query": "food for my family", "language": "en", "took": 38 }
}
```

#### `POST /search`

```json
{
  "entity": "programs",
  "query": "childcare",
  "filters": { "category": "childcare", "language": "en" },
  "limit": 20,
  "offset": 0
}
```

`entity` ∈ `programs`, `organizations`, `questions`, `cases`, `auditLogs`.

---

### 2.19 Reports (caseworker / admin)

Aggregate views for staff. All require `caseworker` or `admin` role and accept the same date-range / program filters.

#### Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/reports/overview` | Role-gated | High-level KPIs |
| `GET` | `/reports/eligibility-outcomes` | Role-gated | Counts by outcome |
| `GET` | `/reports/program-demand` | Role-gated | Per-program eligible counts |
| `GET` | `/reports/drop-off` | Role-gated | Step at which sessions abandon |
| `GET` | `/reports/completion-rate` | Role-gated | Completed / started |
| `GET` | `/reports/document-uploads` | Role-gated | Volume + OCR success rate |
| `GET` | `/reports/referrals` | Role-gated | Status breakdown |
| `GET` | `/reports/notifications` | Role-gated | Delivery success |
| `GET` | `/reports/language-usage` | Role-gated | Sessions by language |
| `GET` | `/reports/audit-activity` | Role-gated | Recent admin actions |

#### Common query parameters

| Query | Type | Default | Description |
|---|---|---|---|
| `startDate`, `endDate` | ISO date | trailing 30 days | Inclusive range |
| `programId` | uuid | — |  |
| `language` | string | — |  |
| `format` | enum | `json` | `json` or `csv` (CSV streams as `text/csv`) |

`POST /reports/exports/:report` queues an async export job for large datasets.

---

## 3. Admin-only resources (brief)

The following resources have HTTP surface but aren't user-facing; they are documented at the route level only. Schemas track the Prisma models 1:1.

| Resource | Routes |
|---|---|
| Eligibility rule versions | `GET/POST /programs/:programId/rule-versions`, `POST .../publish` |
| AI knowledge sources | `GET/POST/PATCH/DELETE /ai/knowledge-sources`, `POST .../reindex` |
| Anomaly flags | `GET /anomaly-flags`, `PATCH /anomaly-flags/:id` (review workflow) |
| Audit logs | `GET /audit-logs`, `GET /audit-logs/:id` — append-only, no write API |
| Roles & permissions | `GET/POST/PATCH/DELETE /roles`, `.../permissions`, `/users/:userId/roles` |

---

## 4. Out of scope for v1

- Webhooks / outbound event delivery
- Bulk import endpoints (`POST /imports`)
- Service-to-service tokens
- File downloads via the API (storage URLs are signed and returned in `documentUploads.storageUrl`)
- OpenAPI/Swagger schema (this doc is the source of truth until contracts stabilise)

---

## 5. Change log

| Date | Change |
|---|---|
| 2026-05-28 | Initial draft |
