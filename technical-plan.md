# BRIDGE Technical Plan

BRIDGE — **Benefits Resource Intelligence & Digital Guidance Engine** — is a T3 Stack web application that helps residents screen for benefits, understand next steps, upload documents, and receive AI-assisted guidance.

This technical plan documents the proposed application structure, state management, API patterns, AI integration points, error handling, fallback behavior, and security considerations.

# 1. Component Structure

The app will use **Next.js App Router** with a feature-based component structure.

## Suggested Folder Structure

```txt
src/
  app/
    layout.tsx
    page.tsx

    auth/
      magic-link/
        page.tsx
      verify/
        page.tsx

    screening/
      start/
        page.tsx
      [sessionId]/
        page.tsx
      [sessionId]/results/
        page.tsx
      [sessionId]/documents/
        page.tsx

    programs/
      page.tsx
      [programId]/
        page.tsx

    dashboard/
      page.tsx
      cases/
        page.tsx
      reports/
        page.tsx
      rules/
        page.tsx

    api/
      auth/
      upload/
      webhooks/

  components/
    ui/
    layout/
    auth/
    screening/
    results/
    documents/
    ai/
    admin/

  server/
    api/
      root.ts
      trpc.ts
      routers/
        auth.ts
        users.ts
        screening.ts
        questions.ts
        programs.ts
        eligibility.ts
        documents.ts
        notifications.ts
        referrals.ts
        ai.ts
        reports.ts
        admin.ts

    services/
      eligibility-rules.service.ts
      document-classification.service.ts
      notification.service.ts
      ai.service.ts
      search.service.ts
      audit-log.service.ts

    db.ts

  lib/
    auth.ts
    permissions.ts
    validations/
      screening.schema.ts
      questions.schema.ts
      documents.schema.ts
      ai.schema.ts
    constants.ts
    errors.ts
    rate-limit.ts

  stores/
    screening-store.ts
    ui-store.ts
    ai-chat-store.ts

  styles/
    globals.css
```

# 2. Component Design Principles

## Mobile-First UX

Resident-facing pages should prioritize:

- one question per screen
- large tap targets
- plain-language labels
- visible progress indicator
- accessible contrast
- minimal cognitive load
- responsive layouts

## Feature-Based Components

Each major product area should have its own component group:

- `screening/`
- `results/`
- `documents/`
- `ai/`
- `admin/`
- `auth/`

This keeps the app easier to scale as features grow.

## Server vs Client Components

Use **Server Components** for:

- static program pages
- server-rendered dashboard data
- read-only result pages
- SEO-friendly content

Use **Client Components** for:

- screening question flow
- AI chat widget
- file upload interactions
- progress indicators
- form validation
- dashboard filters

# 3. State Management

BRIDGE should use a layered state management approach.

## Server State

Use **TanStack Query** through tRPC for server data such as:

- questions
- screening answers
- eligibility results
- program details
- document checklist
- case dashboard records
- reports

Server state should be fetched and mutated through tRPC procedures.

## Local UI State

Use **Zustand** for lightweight client-side UI state.

Good Zustand use cases:

- current question index
- temporary answer draft
- mobile menu state
- AI chat panel open/closed
- unsaved changes warning
- selected dashboard filters

Example stores:

```txt
stores/
  screening-store.ts
  ui-store.ts
  ai-chat-store.ts
```

## Form State

Use:

- React Hook Form
- Zod validation

Recommended use cases:

- magic link form
- notification preferences form
- document upload metadata
- admin rule editor
- user profile forms

## Persistent State

Persist only low-risk state in local storage, such as:

- preferred language
- last visited screening step
- UI theme

Do **not** store sensitive eligibility answers, uploaded document data, tokens, or personal information in local storage.

# 4. API / Server Action Patterns

Because BRIDGE uses the T3 Stack, the primary API pattern should be **tRPC**.

## tRPC Routers

Recommended routers:

```txt
authRouter
userRouter
screeningRouter
questionRouter
programRouter
eligibilityRouter
documentRouter
notificationRouter
referralRouter
aiRouter
reportRouter
adminRouter
```

## Example tRPC Procedure Groups

### Screening

```ts
screening.createSession
screening.getSession
screening.updateSession
screening.saveAnswer
screening.getAnswers
screening.completeSession
```

### Eligibility

```ts
eligibility.run
eligibility.getResults
eligibility.getResultById
eligibility.generateDocumentChecklist
```

### Documents

```ts
documents.createUploadUrl
documents.confirmUpload
documents.getSessionDocuments
documents.classifyDocument
documents.deleteDocument
```

### AI

```ts
ai.createConversation
ai.sendMessage
ai.ask
ai.requestHumanHandoff
ai.submitFeedback
```

### Reports

```ts
reports.getOverview
reports.getDropoff
reports.getEligibilityOutcomes
reports.getProgramDemand
reports.exportCsv
```

## Server Actions

Use server actions sparingly for simple page-specific forms.

Good server action candidates:

- language preference update
- simple contact request
- waitlist form
- admin quick actions

Prefer **tRPC mutations** for core workflows because they are reusable and easier to test.

## REST Route Handlers

Use REST route handlers for:

- file upload callbacks
- webhook integrations
- SMS/email provider callbacks
- health checks
- external partner integrations

Example routes:

```txt
POST /api/upload/presign
POST /api/webhooks/twilio
POST /api/webhooks/email-provider
GET  /api/health
```

# 5. AI Integration Points

AI should improve support and efficiency, but should **not** determine official eligibility.

Official eligibility should come from the deterministic rules engine.

## AI Chatbot

### Purpose

Help residents understand benefits in plain language.

### Integration Point

```txt
ai.ask
ai.sendMessage
```

### Data Sources

- approved program descriptions
- authoritative government pages
- internal knowledge sources
- application instructions
- document requirement explanations

### Requirements

- use retrieval-augmented generation
- include citations
- use plain language
- support English and Spanish
- offer human handoff
- never present itself as final legal authority

## Smart Search

### Purpose

Allow users to search programs using natural language.

Example queries:

- “help paying rent”
- “food assistance for my kids”
- “pregnant and need healthcare”
- “utility bill shutoff help”

### Integration Point

```txt
search.service.ts
programRouter.search
aiRouter.semanticSearch
```

### Implementation Options

- PostgreSQL full-text search
- pgvector embeddings
- external vector database
- hybrid keyword + semantic search

## Document Classification

### Purpose

Classify uploaded documents and update checklist status.

### Integration Point

```txt
document-classification.service.ts
documents.classifyDocument
```

### Supported Classification Examples

- pay stub
- lease
- utility bill
- ID
- birth certificate
- medical documentation
- childcare receipt

### Safeguards

- classification is assistive only
- users can override classifications
- caseworkers can correct classifications
- OCR failure should not block progress

## Recommendation Engine

### Purpose

Recommend additional programs, resources, and next steps.

### Integration Point

```txt
ai.service.ts
eligibility.service.ts
referral.service.ts
```

### Example Recommendations

- related programs
- nearby nonprofit partners
- missing documents
- language-specific resources
- urgent assistance pathways

## Anomaly Detection

### Purpose

Flag unusual activity for staff review.

### Examples

- duplicate sessions
- repeated failed uploads
- suspicious document metadata
- abnormal application spikes
- unusually high referral volume

### Safeguards

- flag only
- no automatic denial
- no automatic account suspension
- staff review required

## Analytics and Forecasting

### Purpose

Help administrators understand demand and improve operations.

### AI Analytics Features

- predictive processing times
- workload forecasting
- trend analysis
- resource optimization
- performance insights

### Integration Point

```txt
reportRouter
reports.service.ts
analytics.service.ts
```

# 6. Error Handling & Fallback Strategies

## Global Error Categories

Use a consistent error model:

```txt
VALIDATION_ERROR
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
NOT_FOUND
RATE_LIMITED
UPLOAD_FAILED
AI_UNAVAILABLE
RULE_ENGINE_ERROR
SERVER_ERROR
```

## Frontend Error Handling

Use:

- inline form validation
- toast notifications for non-blocking errors
- full-page error boundaries for major failures
- retry buttons for recoverable errors
- plain-language error messages

## API Error Handling

Use:

- typed tRPC errors
- Zod validation errors
- structured logging
- audit logs for sensitive actions
- safe error messages for users
- detailed internal logs for developers

## AI Fallbacks

If AI is unavailable:

- continue deterministic eligibility screening
- show standard FAQ content
- show official program links
- offer human handoff
- do not block the user journey

## OCR Fallbacks

If OCR fails:

- keep uploaded file
- allow manual classification
- allow user to continue
- display “OCR unavailable, but your upload was saved”

## Rules Engine Fallbacks

If the rules engine fails:

- do not guess eligibility
- show “We could not complete your screening right now”
- save user answers
- allow retry
- log the error for review

## Notification Fallbacks

If SMS or email fails:

- retry delivery
- allow user to change contact method
- display notification status
- log failed delivery

---

# 7. Security Considerations

BRIDGE handles sensitive personal information, so security must be designed from the start.

## Authentication

Recommended approach:

- NextAuth
- magic link authentication
- optional SMS verification
- short-lived access tokens
- refresh token rotation
- secure HTTP-only cookies

Avoid password-based authentication for MVP unless required.

## Authorization

Use role-based access control.

Suggested roles:

- resident
- navigator
- caseworker
- admin

Use permission-based middleware for protected actions.

Examples:

```txt
screening:read
screening:update
documents:read
documents:delete
cases:assign
rules:publish
reports:read
audit_logs:read
```

## Input Validation

Use Zod schemas for every API input.

Validate:

- screening answers
- uploaded file metadata
- notification preferences
- AI prompts
- admin rule changes
- referral requests
- report filters

Never trust client-side validation alone.

## Rate Limiting

Rate limit sensitive endpoints.

High-priority endpoints:

```txt
/auth/magic-link/request
/auth/magic-link/verify
/ai/ask
/documents/upload
/search
/reports/export
```

Suggested controls:

- IP-based limits
- user-based limits
- session-based limits
- stricter limits for unauthenticated users

## Row-Level Security

If using Supabase or direct Postgres access, enable RLS.

Recommended RLS rules:

- residents can access only their own sessions
- anonymous sessions require secure session tokens
- navigators can access consented client records
- caseworkers can access assigned cases
- admins can access operational dashboards
- audit logs are read-only and admin-only

If using Prisma with a trusted backend only, enforce equivalent access control in service logic.

## Data Privacy

Minimize sensitive data collection.

Privacy principles:

- do not require SSN
- avoid unnecessary identity proofing
- store only what is needed
- encrypt uploaded documents
- limit document retention
- redact logs
- separate AI logs from sensitive user data when possible

## File Upload Security

Validate uploads by:

- MIME type
- file extension
- file size
- virus scanning where possible
- storage bucket permissions
- signed upload URLs
- private file access

Supported file types:

```txt
JPG
PNG
PDF
HEIC
```

Uploaded files should not be publicly accessible.

## AI Security

AI-specific protections:

- sanitize prompts
- restrict model access to approved knowledge sources
- prevent prompt injection from documents
- do not send unnecessary PII to the model
- log AI responses for safety review
- include citations
- provide human handoff
- clearly label AI-generated content

## Audit Logging

Audit sensitive events such as:

- login
- magic link verification
- eligibility rule updates
- document uploads
- document deletions
- role changes
- case assignment
- referral creation
- admin exports

Audit logs should be append-only.

## Environment Variables

Store secrets in environment variables.

Example variables:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
EMAIL_PROVIDER_API_KEY=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
```

Never commit `.env` files.

# 8. Reliability and Observability

## Logging

Use structured logs for:

- API errors
- AI failures
- upload failures
- notification failures
- rule engine failures
- admin actions

## Monitoring

Recommended tools:

- Sentry for frontend/backend errors
- PostHog for product analytics
- database logs for slow queries
- uptime monitoring for critical endpoints

## Metrics to Track

- screener completion rate
- drop-off by question
- eligibility outcomes by program
- document upload success rate
- AI chatbot resolution rate
- referral completion rate
- average session duration
- error rate by endpoint

# 9. MVP Implementation Plan

## Phase 1 — Foundation

- Set up T3 Stack
- Configure PostgreSQL
- Implement Prisma schema
- Add NextAuth magic link flow
- Create basic layout and navigation

## Phase 2 — Screening

- Build question flow
- Save anonymous sessions
- Store answers
- Add progress indicator
- Add English/Spanish content support

## Phase 3 — Eligibility

- Implement deterministic rules engine
- Run multi-program screening
- Display ranked results
- Generate document checklist

## Phase 4 — AI Assistance

- Add AI chatbot
- Add source-cited responses
- Add smart program search
- Add human handoff option

## Phase 5 — Admin Tools

- Build caseworker dashboard
- Add reporting dashboard
- Add audit logging
- Add rule version management
