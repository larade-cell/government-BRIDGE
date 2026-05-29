# BRIDGE API Specification

Detailed reference for every user-facing endpoint. Each resource section lists routes, query parameters, request and response schemas, and the typical example payloads. See [`api-routes.md`](../api-routes.md) at the repo root for the higher-level status table mapping REST routes to tRPC procedures.

> **Implementation note.** Routes below are documented in REST shape for clarity. The actual implementation is tRPC procedures under `/api/trpc/<router>.<procedure>` (one-to-one mapping). REST paths are aspirational and used to communicate resource modeling.

---

## 1. Conventions

### 1.0 Best practices checklist

These rules apply to every route in this document. If you find a route that violates one, fix the route, not the rule.

- **Resource paths are plural nouns.** `/programs`, not `/program`. Collections are plural; the singular form is the resource within a collection (`/programs/:programId`).
- **HTTP methods carry the verb.** Use `GET` to read, `POST` to create, `PUT` to replace or upsert, `PATCH` to partially update, `DELETE` to remove. Path verbs are reserved for actions that don't fit CRUD (`/.../complete`, `/.../publish`, `/.../handoff`).
- **Query parameters for filtering, sorting, pagination, expansion.** See §1.4–§1.7. Bodies are for state, not for selection.
- **Consistent response envelope.** Lists return `{ data: [...], meta: {...} }`. Single resources return the resource shape directly. Errors return `{ error: { code, message, details? } }` (§1.9).
- **Use the right HTTP status codes** — see §1.9 for the full table. Quick reference: `200 OK` for reads, `201 Created` for new resources, `204 No Content` for empty success (e.g. `DELETE`), `4xx` for client mistakes, `5xx` for server faults.
- **Version the API in the URL.** Current is `/api/v1` (§1.1). Breaking changes ship to `/api/v2`; additive changes stay in `v1`.
- **No PII in URLs.** Identifiers (uuids) only. Emails and phone numbers go in the request body.
- **All timestamps are ISO 8601 UTC.** Server sends `Z`-suffixed strings; client sends the same.
- **Idempotent writes.** `PUT` and `DELETE` are idempotent by HTTP contract; `POST` should be made idempotent via `Idempotency-Key` (§1.10).

### 1.1 Base URL and versioning

```
/api/v1
```

Breaking changes ship under `/api/v2`. Additive changes go to `v1`.

### 1.2 Field naming

**The wire contract is `snake_case`**, matching the Prisma/Postgres layer end to end. The tRPC procedures take and return `snake_case` fields directly (e.g. `session_id`, `preferred_language`, `answer_value`); there is no camelCase translation layer. The REST examples in this document use `snake_case` field names accordingly.

> **Known inconsistency.** The Phase 3 procedures (`user.update`, `notificationPreference.*`, `referral.create`) currently accept **`camelCase` inputs** (`preferredLanguage`, `sessionId`, `needCategory`) while still returning `snake_case`. Their outputs match the contract; their inputs are a wart to be normalized to `snake_case`. New routers (Phase 1/2/4) are `snake_case` in and out.

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
| `page` | integer (≥1) | 1 | One-based page number |
| `limit` | integer (1-100) | 20 | Page size |

Responses include a `meta` object:

```json
{
  "data": [ /* ... */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 137,
    "totalPages": 7
  }
}
```

Server enforces `limit <= 100`. Requests beyond `totalPages` return an empty `data` array with the correct `meta`.

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

#### Envelope

Every non-2xx response uses this shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Session belongs to another user",
    "details": null,
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string (enum) | yes | Machine-readable; values from the status matrix below |
| `message` | string | yes | Human-readable English. Not localized — clients map `code` to their own strings |
| `details` | object \| null | no | Shape depends on `code`. Schemas below |
| `requestId` | string | yes | Echo of the server-assigned trace id (also returned in `X-Request-Id` header) |
| `timestamp` | datetime | yes | When the error was produced (UTC, ISO 8601) |

#### Status code matrix

| HTTP | `error.code` | `details` shape | Typical trigger |
|---|---|---|---|
| 400 | `BAD_REQUEST` | `ValidationDetails` (§1.9.1) or `null` | Schema validation failed, malformed JSON, unknown query param |
| 401 | `UNAUTHORIZED` | `null` | Missing / invalid session cookie on an authenticated route |
| 403 | `FORBIDDEN` | `{ reason: string }` (§1.9.3) | Authenticated but lacks permission, or session-ownership mismatch |
| 404 | `NOT_FOUND` | `{ resource: string, id?: string }` | Resource doesn't exist or caller can't see it |
| 409 | `CONFLICT` | `{ reason: string, field?: string }` | Unique constraint, state conflict, duplicate `Idempotency-Key` with different body |
| 413 | `PAYLOAD_TOO_LARGE` | `{ maxBytes: number, receivedBytes: number }` | Upload exceeds the per-file or per-request limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | `{ allowed: string[], received: string }` | `Content-Type` not accepted, or upload mime type rejected |
| 422 | `UNPROCESSABLE` | `{ reason: string, ...context }` (§1.9.2) | Well-formed request but semantically invalid |
| 429 | `RATE_LIMITED` | `{ retryAfterSeconds: number, limit: number, window: string }` | Throttle hit; clients should also honor the `Retry-After` header |
| 500 | `INTERNAL` | `null` | Unhandled server error. `requestId` is the only useful payload; full traces stay server-side |
| 503 | `SERVICE_UNAVAILABLE` | `{ retryAfterSeconds: number }` | Dependency down (DB, AI provider, storage); transient |

#### 1.9.1 Validation errors (`400 BAD_REQUEST`)

When request input fails schema validation, `details` is the `ValidationDetails` shape. This mirrors what `ZodError.flatten()` produces on the server (`src/server/api/trpc.ts`), translated into the REST envelope:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid request",
    "details": {
      "fieldErrors": {
        "email": ["Required", "Invalid email"],
        "preferredLanguage": ["String must contain at most 8 character(s)"]
      },
      "formErrors": []
    },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

`ValidationDetails`:

| Field | Type | Required | Description |
|---|---|---|---|
| `fieldErrors` | `{ [field: string]: string[] }` | yes | One entry per offending field. Nested fields use dot paths (`address.postalCode`). Array indices use bracket notation (`items[0].quantity`). Each value is a list — a field can have multiple violations |
| `formErrors` | `string[]` | yes | Top-level errors not attributable to a single field (e.g., "Either email or phone is required", "Body must be JSON") |

Field paths in `fieldErrors` match the request body shape. For query parameters, the path prefix is the param name (`filter.outcome`, `page`).

Empty `formErrors` and non-empty `fieldErrors` is the common case. The reverse means the request was structurally invalid (e.g., missing body) but no single field was identified.

#### 1.9.2 Domain errors (`422 UNPROCESSABLE`)

Well-formed requests that violate a business rule. `details.reason` is a stable identifier clients can branch on. Additional context fields vary by reason.

| `details.reason` | Trigger | Extra fields |
|---|---|---|
| `SESSION_EXPIRED` | Caller acts on a session past `expiresAt` | `expiredAt: datetime` |
| `SESSION_COMPLETED` | Mutation against a session with `completedAt` set | `completedAt: datetime` |
| `RULE_NOT_PUBLISHED` | `eligibility.run` finds no published rule for a program | `programId: uuid` |
| `ANSWER_TYPE_MISMATCH` | `answerValue` doesn't match `question.answerType` | `expectedType: string, receivedType: string` |
| `UPLOAD_NOT_FINALIZED` | Operating on a `documentUpload` before client PUT to `uploadUrl` completes | `documentUploadId: uuid` |
| `HANDOFF_ALREADY_REQUESTED` | Calling `/ai/conversations/:id/handoff` more than once | — |
| `ORGANIZATION_INACTIVE` | Creating a referral pointing at a deactivated organization | `organizationId: uuid` |

Example:

```json
{
  "error": {
    "code": "UNPROCESSABLE",
    "message": "Session has expired",
    "details": {
      "reason": "SESSION_EXPIRED",
      "expiredAt": "2026-05-25T03:14:15.000Z"
    },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

#### 1.9.3 Authentication and authorization (`401`, `403`)

`401 UNAUTHORIZED` carries no `details` — the caller needs to authenticate before any other discussion is possible. The body is:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "details": null,
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

`403 FORBIDDEN` includes a `reason` so clients can show specific messaging:

| `details.reason` | Trigger |
|---|---|
| `SESSION_OWNER_MISMATCH` | Session has `userId != null` and caller's `appUserId` doesn't match |
| `ROLE_INSUFFICIENT` | Endpoint requires `navigator`/`caseworker`/`admin` and caller has a lower role |
| `RESOURCE_OWNER_MISMATCH` | Caller is authenticated but doesn't own the referenced resource (e.g., a conversation belonging to a different user) |
| `ACCOUNT_DISABLED` | Caller's account is flagged or deactivated |

Example:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Session belongs to another user",
    "details": { "reason": "SESSION_OWNER_MISMATCH" },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

#### 1.9.4 Not found (`404`)

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found",
    "details": { "resource": "screeningSession", "id": "9f7c1c3a-..." },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

`details.resource` is the resource name in singular camelCase. For session-scoped endpoints, a "wrong owner" case returns `403 FORBIDDEN` (not `404`) so clients can distinguish "doesn't exist" from "exists but you can't see it" — except when leakage matters; in those cases the server may return `404` to avoid confirming existence.

#### 1.9.5 Conflict (`409`)

Used for unique-constraint violations and state conflicts.

| `details.reason` | Trigger |
|---|---|
| `UNIQUE_CONSTRAINT` | Tried to create a row that violates a unique index. `details.field` identifies the column |
| `IDEMPOTENCY_KEY_MISMATCH` | Same `Idempotency-Key` reused with a different request body within the 24h window |
| `STATE_CONFLICT` | E.g., publishing an `eligibility_rule_version` that's already published |

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "A notification preference for this destination already exists",
    "details": {
      "reason": "UNIQUE_CONSTRAINT",
      "field": "destination"
    },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

#### 1.9.6 Rate limiting (`429`)

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "retryAfterSeconds": 30,
      "limit": 60,
      "window": "1m"
    },
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

The response also includes a `Retry-After: <seconds>` header. Clients should prefer the header if present.

#### 1.9.7 Server errors (`500`, `503`)

`5xx` responses never leak stack traces or internal details. The only client-actionable payload is `requestId` — quote that to support.

```json
{
  "error": {
    "code": "INTERNAL",
    "message": "An unexpected error occurred",
    "details": null,
    "requestId": "req_01HN8...",
    "timestamp": "2026-05-28T13:14:15.000Z"
  }
}
```

For `503 SERVICE_UNAVAILABLE`, `details.retryAfterSeconds` is set and the `Retry-After` header is included.

#### 1.9.8 Client handling guide

1. **Branch on `error.code` first**, then on `details.reason` for `422`/`403`/`409`. Never branch on `error.message` — it changes without notice.
2. **Render `fieldErrors`** next to the corresponding form fields. Use `formErrors` for a top-of-form banner.
3. **Map codes to translated strings** in your client. Don't display `error.message` directly to non-English users.
4. **Honor `Retry-After`** for `429` and `503`. Implement exponential backoff with jitter on top.
5. **Log `requestId`** with any error report or support ticket — it's the only correlation key into server logs.
6. **`5xx` is the server's fault.** Retry once with backoff before surfacing failure; do not loop indefinitely.

#### tRPC ↔ REST error mapping

Because the implementation is tRPC, the wire format differs slightly. The translation:

| tRPC error | REST equivalent |
|---|---|
| `TRPCError({ code: "BAD_REQUEST" })` with `ZodError` cause | `400 BAD_REQUEST`, `details = ZodError.flatten()` |
| `TRPCError({ code: "UNAUTHORIZED" })` | `401 UNAUTHORIZED` |
| `TRPCError({ code: "FORBIDDEN" })` | `403 FORBIDDEN`, `details.reason = "SESSION_OWNER_MISMATCH"` (or appropriate) |
| `TRPCError({ code: "NOT_FOUND" })` | `404 NOT_FOUND`, `details.resource = "<resource>"` |
| `TRPCError({ code: "CONFLICT" })` | `409 CONFLICT` |
| `TRPCError({ code: "INTERNAL_SERVER_ERROR" })` | `500 INTERNAL` |

The server's `errorFormatter` in `src/server/api/trpc.ts` is the authoritative shape; any divergence between this spec and that file is a bug.

> **Implementation status (2026-05-29).** The current `errorFormatter` returns the default tRPC shape plus a flattened `zodError` (validation errors, §1.9.1). The richer REST envelope — `requestId`, `timestamp`, and the `details.reason` discriminators for `403`/`409`/`422` (§1.9.2–§1.9.5) — is **not yet emitted**; it is the target contract for the planned REST/error-mapping middleware. Today, clients should branch on the tRPC error `code` and, for validation failures, read `data.zodError.fieldErrors`. The domain `reason` codes are surfaced in the human-readable `message` until the middleware lands.

### 1.10 Common request headers

| Header | Required | Description |
|---|---|---|
| `Content-Type` | yes (writes) | `application/json` |
| `Accept-Language` | no | Hint; per-request `?language=` always wins |
| `Idempotency-Key` | no | For `POST`s; replays return the original response within 24h |

---

## 2. Implementation phases

Routes are grouped into three rollout phases. Phase 1 is the MVP — residents can complete the screener end-to-end. Phase 2 fills in account, staff, and AI features. Phase 3 is polish — advanced search, exports, admin tooling.

Cross-reference with [`api-routes.md`](../api-routes.md) for live implementation status; this section captures *intent*, that file tracks *progress*.

### Phase 1 — Core entities (MVP)

Everything a resident needs to complete the screener and see results. Story coverage: 1, 2, 5, 6, 7, 8, 9, 15 (partial — uploads + classification).

| Resource | Section | Stories | Notes |
|---|---|---|---|
| Screening Sessions | §3.1 | 1, 2, 4 (claim) | Anonymous create + session-scoped reads |
| Questions | §3.2 | 5 | Reference content, read-only for clients |
| Screening Answers | §3.3 | 5 | Upsert by `(sessionId, questionId)` |
| Programs (read) | §3.4 | 6, 7, 10 | Catalog browse |
| Eligibility Results | §3.5 | 6, 7 | Run + list |
| Document Types (read) | §3.6 | 8 | Reference for checklist |
| Session Document Checklist | §3.7 | 8 | Generated per session |
| Document Uploads | §3.8 | 9, 15 | Two-step presigned upload |
| Users (`/users/me` only) | §3.9 | 4 | Authenticated reads/updates of own profile |

### Phase 2 — Related and admin endpoints

Account features, staff dashboards, AI navigator, search. Story coverage: 3, 4, 10, 11, 12, 13, 14, 16, 18, 20.

| Resource | Section | Stories | Notes |
|---|---|---|---|
| Notification Preferences | §3.10 | 12 | Per-user OR per-session |
| Organizations | §3.11 | 11 | Read public; mutations admin-only |
| Referrals | §3.12 | 11 | Nullable `organizationId` for in-person help |
| Life Events | §3.13 | 10 | Browse-by-life-event |
| AI Conversations & Messages | §3.14 | 13 | Stateful chat + one-shot `/ai/ask` |
| AI Recommendations | §3.15 | 16 | Polymorphic targets, status workflow |
| Cases | §3.16 | 18 | Caseworker dashboard |
| Case Notes | §3.17 | 18 | Internal vs external |
| Search (`GET /search/*`) | §3.18 | 14, 10 | Natural-language + plain |
| Reports (read) | §3.19 | 18, 20 | JSON output, role-gated |
| Eligibility Rule Versions | §4 | 20 | Versioned publishing |

### Phase 3 — Optional enhancements

Polish and admin tooling that can ship after Phase 2 without blocking residents or staff. Story coverage: 17, plus operational concerns from §20.

| Resource | Section | Notes |
|---|---|---|
| Advanced Search (`POST /search`) | §3.18 | Structured queries with filters |
| Report exports (`POST /reports/exports/:report`) | §3.19 | Async CSV jobs |
| AI Knowledge Sources management | §4 | Admin CRUD + reindex |
| Anomaly Flags review UI | §4 | Story 17, admin workflow |
| Audit Logs reads | §4 | Compliance / debugging |
| Roles & Permissions management | §4 | Admin-only |
| Account deletion (`DELETE /users/me`) | §3.9 | Soft-delete; depends on retention policy |
| Webhooks / outbound events | §5 | Future — out of scope for v1 |
| OpenAPI generation | §5 | Future — convert this doc once contracts stabilise |

### Phase exit criteria

A phase is "done" when:

- Every route in the phase has Designed / Implemented / Tested checkboxes ticked in `api-routes.md`.
- All status codes from §1.9 are returned correctly for the routes in that phase (verified by integration tests).
- Pagination, sorting, filtering, and expansion are exercised by at least one test per applicable list endpoint.
- For Phase 1: the anonymous → claim → eligibility-run → checklist → upload flow runs end-to-end against the deployed stack.

---

## 3. Resources

### 3.1 Screening Sessions

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
| `page`, `limit` | — | — | Pagination |
| `sort` | string | `-createdAt` | `createdAt`, `-createdAt`, `completedAt`, `-completedAt` |
| `filter[completed]` | boolean | — | `true` returns only completed |

---

### 3.2 Questions

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

### 3.3 Screening Answers

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

### 3.4 Programs

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
| `page`, `limit` | — | — |  |

---

### 3.5 Eligibility Results

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

### 3.6 Document Types

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

### 3.7 Session Document Checklist

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

### 3.8 Document Uploads

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

### 3.9 Users

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

### 3.10 Notification Preferences

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

### 3.11 Organizations

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
| `page`, `limit` | — | — |  |

---

### 3.12 Referrals

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

### 3.13 Life Events (browse)

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

### 3.14 AI Conversations and Messages

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

### 3.15 AI Recommendations

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

### 3.16 Cases (caseworker dashboard)

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
| `page`, `limit` | — | — |  |

---

### 3.17 Case Notes

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

### 3.18 Search

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
  "page": 1,
  "limit": 20
}
```

`entity` ∈ `programs`, `organizations`, `questions`, `cases`, `auditLogs`.

---

### 3.19 Reports (caseworker / admin)

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

## 4. Admin-only resources (brief)

The following resources have HTTP surface but aren't user-facing; they are documented at the route level only. Schemas track the Prisma models 1:1.

| Resource | Routes |
|---|---|
| Eligibility rule versions | `GET/POST /programs/:programId/rule-versions`, `POST .../publish` |
| AI knowledge sources | `GET/POST/PATCH/DELETE /ai/knowledge-sources`, `POST .../reindex` |
| Anomaly flags | `GET /anomaly-flags`, `PATCH /anomaly-flags/:id` (review workflow) |
| Audit logs | `GET /audit-logs`, `GET /audit-logs/:id` — append-only, no write API |
| Roles & permissions | `GET/POST/PATCH/DELETE /roles`, `.../permissions`, `/users/:userId/roles` |

---

## 5. Out of scope for v1

- Webhooks / outbound event delivery
- Bulk import endpoints (`POST /imports`)
- Service-to-service tokens
- File downloads via the API (storage URLs are signed and returned in `documentUploads.storageUrl`)
- OpenAPI/Swagger schema (this doc is the source of truth until contracts stabilise)

---

## 6. Change log

| Date | Change |
|---|---|
| 2026-05-28 | Initial draft |
| 2026-05-28 | Added §1.0 best-practices checklist, §2 implementation phases; switched pagination to `page`/`limit`. |
| 2026-05-28 | Expanded §1.9 with full error envelope (`requestId`, `timestamp`), validation error schema (`fieldErrors`/`formErrors`), domain reason tables for 403/409/422, status matrix incl. 413/415/503, client handling guide, and tRPC↔REST mapping. |
| 2026-05-29 | §1.2 corrected to document the actual `snake_case` wire contract (was aspirational camelCase) and flag the Phase 3 camelCase-input wart. §1.9 annotated with current `errorFormatter` status (rich envelope not yet emitted). Phase 2 (programs/checklist/uploads/search) and Phase 4 (ai.ask, reports, cases, rule-versions) procedures implemented and covered by Vitest API tests. |
