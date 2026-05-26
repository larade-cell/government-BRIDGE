# API Routes

Base URL:

```http
/api/v1
```

## Authentication

```http
POST   /auth/magic-link/request
POST   /auth/magic-link/verify
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me
GET    /auth/sessions
DELETE /auth/sessions/:sessionId
```

### Example: Request Magic Link

```http
POST /api/v1/auth/magic-link/request
```

```json
{
  "email": "user@example.com",
  "phone": null,
  "sessionId": "uuid"
}
```

### Example: Verify Magic Link

```http
POST /api/v1/auth/magic-link/verify
```

```json
{
  "token": "abc123"
}
```

---

## Authorization

```http
GET    /auth/permissions
POST   /auth/roles/assign
DELETE /auth/roles/remove
```

## Roles

```http
GET    /roles
POST   /roles
GET    /roles/:roleId
PATCH  /roles/:roleId
DELETE /roles/:roleId
```

## Permissions

```http
GET    /permissions
POST   /permissions
GET    /permissions/:permissionId
PATCH  /permissions/:permissionId
DELETE /permissions/:permissionId
```

## Role Permissions

```http
GET    /roles/:roleId/permissions
POST   /roles/:roleId/permissions
DELETE /roles/:roleId/permissions/:permissionId
```

## User Roles

```http
GET    /users/:userId/roles
POST   /users/:userId/roles
DELETE /users/:userId/roles/:roleId
```

---

## Users

```http
GET    /users
POST   /users
GET    /users/:userId
PATCH  /users/:userId
DELETE /users/:userId
```

---

## Screening Sessions

```http
POST   /screening-sessions
GET    /screening-sessions
GET    /screening-sessions/:sessionId
PATCH  /screening-sessions/:sessionId
DELETE /screening-sessions/:sessionId
POST   /screening-sessions/:sessionId/complete
```

---

## Screening Answers

```http
GET    /screening-sessions/:sessionId/answers
POST   /screening-sessions/:sessionId/answers
GET    /screening-sessions/:sessionId/answers/:answerId
PATCH  /screening-sessions/:sessionId/answers/:answerId
DELETE /screening-sessions/:sessionId/answers/:answerId
```

---

## Questions

```http
GET    /questions
POST   /questions
GET    /questions/:questionId
PATCH  /questions/:questionId
DELETE /questions/:questionId
```

## Question Translations

```http
GET    /questions/:questionId/translations
POST   /questions/:questionId/translations
PATCH  /questions/:questionId/translations/:languageCode
DELETE /questions/:questionId/translations/:languageCode
```

## Answer Options

```http
GET    /questions/:questionId/options
POST   /questions/:questionId/options
GET    /questions/:questionId/options/:optionId
PATCH  /questions/:questionId/options/:optionId
DELETE /questions/:questionId/options/:optionId
```

---

## Programs

```http
GET    /programs
POST   /programs
GET    /programs/:programId
PATCH  /programs/:programId
DELETE /programs/:programId
```

## Program Translations

```http
GET    /programs/:programId/translations
POST   /programs/:programId/translations
PATCH  /programs/:programId/translations/:languageCode
DELETE /programs/:programId/translations/:languageCode
```

---

## Eligibility Rules

```http
GET    /programs/:programId/rule-versions
POST   /programs/:programId/rule-versions
GET    /programs/:programId/rule-versions/:ruleVersionId
PATCH  /programs/:programId/rule-versions/:ruleVersionId
DELETE /programs/:programId/rule-versions/:ruleVersionId
POST   /programs/:programId/rule-versions/:ruleVersionId/publish
```

---

## Eligibility Results

```http
POST   /screening-sessions/:sessionId/eligibility/run
GET    /screening-sessions/:sessionId/eligibility-results
GET    /screening-sessions/:sessionId/eligibility-results/:resultId
DELETE /screening-sessions/:sessionId/eligibility-results/:resultId
```

---

## Document Checklist

```http
GET    /screening-sessions/:sessionId/document-checklist
POST   /screening-sessions/:sessionId/document-checklist/generate
PATCH  /screening-sessions/:sessionId/document-checklist/:checklistItemId
DELETE /screening-sessions/:sessionId/document-checklist/:checklistItemId
```

---

## Document Types

```http
GET    /document-types
POST   /document-types
GET    /document-types/:documentTypeId
PATCH  /document-types/:documentTypeId
DELETE /document-types/:documentTypeId
```

---

## Document Uploads

```http
GET    /screening-sessions/:sessionId/documents
POST   /screening-sessions/:sessionId/documents
GET    /screening-sessions/:sessionId/documents/:documentId
PATCH  /screening-sessions/:sessionId/documents/:documentId
DELETE /screening-sessions/:sessionId/documents/:documentId
POST   /screening-sessions/:sessionId/documents/:documentId/ocr
```

---

## Notifications

```http
GET    /notification-preferences
POST   /notification-preferences
GET    /notification-preferences/:preferenceId
PATCH  /notification-preferences/:preferenceId
DELETE /notification-preferences/:preferenceId
```

## Notification Events

```http
GET    /notification-events
POST   /notification-events
GET    /notification-events/:eventId
```

## Notification Deliveries

```http
GET    /notification-deliveries
GET    /notification-deliveries/:deliveryId
POST   /notification-deliveries/:deliveryId/retry
```

---

## Organizations

```http
GET    /organizations
POST   /organizations
GET    /organizations/:organizationId
PATCH  /organizations/:organizationId
DELETE /organizations/:organizationId
```

---

## Referrals

```http
GET    /referrals
POST   /referrals
GET    /referrals/:referralId
PATCH  /referrals/:referralId
DELETE /referrals/:referralId
POST   /referrals/:referralId/send
```

---

## AI Navigator

```http
POST   /ai/conversations
GET    /ai/conversations
GET    /ai/conversations/:conversationId
DELETE /ai/conversations/:conversationId

GET    /ai/conversations/:conversationId/messages
POST   /ai/conversations/:conversationId/messages
POST   /ai/conversations/:conversationId/handoff
```

## AI Ask

```http
POST /ai/ask
```

Example request:

```json
{
  "sessionId": "uuid",
  "question": "Do I qualify for WIC if I am pregnant?",
  "language": "en"
}
```

Example response:

```json
{
  "answer": "You may qualify for WIC based on pregnancy status and income. Final eligibility is determined by the administering agency.",
  "citations": [
    {
      "title": "WIC Eligibility Requirements",
      "url": "https://example.gov/wic"
    }
  ],
  "humanHandoffOffered": true
}
```

## AI Knowledge Sources

```http
GET    /ai/knowledge-sources
POST   /ai/knowledge-sources
GET    /ai/knowledge-sources/:sourceId
PATCH  /ai/knowledge-sources/:sourceId
DELETE /ai/knowledge-sources/:sourceId
POST   /ai/knowledge-sources/:sourceId/reindex
```

## AI Feedback and Evaluation

```http
POST   /ai/messages/:messageId/feedback
GET    /ai/evaluations
POST   /ai/evaluations/run
GET    /ai/evaluations/:evaluationId
```

---

## Reporting

```http
GET /reports/overview
GET /reports/eligibility-outcomes
GET /reports/program-demand
GET /reports/drop-off
GET /reports/completion-rate
GET /reports/document-uploads
GET /reports/referrals
GET /reports/notifications
GET /reports/language-usage
GET /reports/audit-activity
```

Common query parameters:

```http
?startDate=2026-01-01&endDate=2026-01-31
?programId=uuid
?language=en
?format=json
?format=csv
```

## Report Exports

```http
GET /reports/export/screening-sessions
GET /reports/export/eligibility-results
GET /reports/export/referrals
GET /reports/export/document-uploads
```

---

## Search

```http
GET /search/programs?q=housing
GET /search/organizations?q=food%20pantry&zipCode=10001
GET /search/questions?q=income
GET /search/cases?q=pending
GET /search/audit-logs?q=rule_updated
```

## Advanced Search

```http
POST /search
```

Example request:

```json
{
  "entity": "programs",
  "query": "childcare",
  "filters": {
    "category": "childcare",
    "language": "en"
  },
  "limit": 20,
  "offset": 0
}
```

---

## Cases

```http
GET    /cases
POST   /cases
GET    /cases/:caseId
PATCH  /cases/:caseId
DELETE /cases/:caseId
```

## Case Notes

```http
GET    /cases/:caseId/notes
POST   /cases/:caseId/notes
PATCH  /cases/:caseId/notes/:noteId
DELETE /cases/:caseId/notes/:noteId
```

---

## Benefit Estimates

```http
GET    /screening-sessions/:sessionId/benefit-estimates
POST   /screening-sessions/:sessionId/benefit-estimates/generate
GET    /screening-sessions/:sessionId/benefit-estimates/:estimateId
DELETE /screening-sessions/:sessionId/benefit-estimates/:estimateId
```

---

## Audit Logs

```http
GET /audit-logs
GET /audit-logs/:auditLogId
```

Audit logs should usually be append-only and generated internally by the backend.

---

## Recommended MVP Route Set

```http
POST /screening-sessions
GET  /questions
POST /screening-sessions/:sessionId/answers
POST /screening-sessions/:sessionId/eligibility/run
GET  /screening-sessions/:sessionId/eligibility-results
GET  /screening-sessions/:sessionId/document-checklist

POST /auth/magic-link/request
POST /auth/magic-link/verify
GET  /auth/me

GET  /search/programs
GET  /search/organizations
POST /ai/ask
GET  /reports/overview
GET  /reports/drop-off
```

---

## Suggested Permission Names

```text
screening:create
screening:read
screening:update
screening:delete

questions:read
questions:create
questions:update
questions:delete

programs:read
programs:create
programs:update
programs:delete

rules:read
rules:create
rules:update
rules:publish

documents:create
documents:read
documents:delete

notifications:read
notifications:update

referrals:create
referrals:read
referrals:update

cases:read
cases:update
cases:assign

reports:read
reports:export

ai:ask
ai:manage_sources

audit_logs:read

users:read
users:update
roles:assign
```
