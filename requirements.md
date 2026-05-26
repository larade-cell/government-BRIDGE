# Requirements: AI-Powered Benefits Eligibility Navigator
(made with the help of Claude)

**Project:** An AI-powered benefits eligibility navigator — a govtech web app that helps residents find and apply for public benefits they qualify for (SNAP/WIC, rental assistance, utility relief, childcare subsidies, Medicaid).

**Document purpose:** Consolidated requirements organized into four categories — User Needs, Functionality Requirements, Technical Requirements, and AI Enhancements. Priorities are marked **P0** (must-have for MVP), **P1** (should-have), **P2** (nice-to-have), and **P3** (out-of-scope / document only).

---

## 1. User Needs

These are the human-centered needs the product must serve, grounded in the user-journey and frustrations research.

### 1.1 Core user needs (P0)
- **Know quickly whether they're likely eligible.** Users want a fast answer to "Am I eligible?" and "How much might I get?" — ideally in under 5 minutes, without creating an account or entering sensitive identifiers.
- **Understand the process in plain language.** Requirements are written in dense policy language; users need 6th–8th grade reading-level explanations of what programs are, what's required, and what happens next.
- **Avoid wasted effort.** Users abandon long, confusing forms and apply for the wrong programs. They need to be guided only to programs they likely qualify for, with a clear next step.
- **Know what documents they need.** Document ambiguity is a top driver of procedural denials. Users need a personalized, plain-language checklist.
- **Not get lost or feel surveilled.** Users report feeling "like a number" or "like a fraud-prevention system." They need a warm, respectful, low-stigma experience and assurance about privacy.
- **Reach a human when stuck.** A meaningful share of users need or prefer assistance; an AI tool must always offer escalation to a person or a community organization.

### 1.2 Needs by user type (P1)
- **First-time applicants** need education and reassurance ("what is this, will I get in trouble, am I eligible?").
- **Returning users** need fast paths to upload a document, check status, or report a change.
- **Assisted users** (helped by a caseworker, navigator, family member, or CBO) need a way for a trusted intermediary to help them.
- **Vulnerable populations** — older adults, people with disabilities, people with limited English proficiency, people with low digital literacy, and people experiencing homelessness — drop off disproportionately and need extra care at every stage.

### 1.3 Access and inclusion needs (P0)
- **Mobile-first.** Plan for 70%+ of traffic on phones; many users are smartphone-dependent.
- **Multilingual.** English + Spanish at minimum; culturally appropriate translation, not machine-only.
- **Accessible.** Usable by screen-reader, keyboard-only, low-vision, and low-literacy users (WCAG 2.1 AA).
- **Anonymous-friendly.** No account or identity proofing required to screen for eligibility (this is also a federal SNAP requirement).
- **Trustworthy.** Clear privacy notice, no-account browsing, source-cited AI answers, and explicit consent for any data sharing — addressing the ~25% of non-applicants who cite privacy concerns and ~24% who cite prior bad experiences.

### 1.4 Success measures tied to user needs (P1)
- Screener completion rate > 55%.
- Screener completion time < 5 minutes; full guided application < 15 minutes.
- Equity gap (e.g., Spanish vs. English completion) < 10 percentage points.
- Reduction in procedural denials via reminders and document help.

---

## 2. Functionality Requirements

What the system must *do*, organized as features and the workflow it supports.

### 2.1 Essential features

**P0 — Must-have**
- **Anonymous eligibility pre-screener.** 8–12 plain-language questions (household size, income range, age, residency, citizenship/immigration status as yes/no/unsure, disability, pregnancy, key expenses). Returns a prioritized list of "likely eligible / may be eligible" programs. No account, no SSN, one question per screen, visible progress indicator.
- **Deterministic eligibility rules engine.** Version-controlled, encoded rules per program (JSON/YAML or an external rules-as-code API). **Not** an LLM. Index toward false-positives (better to over-refer than miss an eligible person).
- **Multi-program determination.** One questionnaire screens across several programs at once (SNAP, WIC, Medicaid/CHIP, LIHEAP/utility relief, rental assistance, childcare subsidy).
- **Plain-language, mobile-first UI.** One thing per page, branching logic, 6th–8th grade reading level.
- **Results page with next steps.** Clear "what you qualify for," "what to do next," and links to the authoritative application for each program.
- **Personalized document checklist.** Generated dynamically from screener answers.
- **Save-and-resume.** Session persistence via magic link or SMS code; no password required.
- **Multilingual content.** English + Spanish at MVP (i18n architecture for more).

**P1 — Should-have**
- **Document upload** via phone camera (accept JPG/PNG/PDF/HEIC); OCR is optional and assistive, never a gate.
- **Conversational AI navigator** that answers eligibility questions in plain language with source citations and always offers a human handoff.
- **Notification preferences center** (channel, language, frequency, opt-in/opt-out).
- **Referrals / warm handoff** to 211 or community organizations for unmet needs.
- **Program discovery / search** (browse by category and life event).
- **Address autocomplete / verification.**

**P2 — Nice-to-have**
- Optional user accounts (no identity proofing required to screen).
- Trusted-intermediary role (a navigator manages applications for clients).
- Caseworker/admin dashboard (queue, status, notes, no-code rule editing).
- Estimated benefit amount (show a *range* with clear "estimate only" framing).

### 2.2 Workflow stages the system must support

Model the application as an explicit **state machine** with timestamped transitions and a clear actor (applicant / system / caseworker) for each.

1. **Discovery / awareness** — SEO pages, deep links, QR codes, outreach campaigns.
2. **Screening** — `started → in_progress → completed → eligible_routed | ineligible_referred`.
3. **Application intake** — `draft → submitted`; autosave, validation, conditional logic.
4. **Document submission / verification** — `documents_pending → partial → complete`.
5. **Identity proofing** — `unverified → verified` (orthogonal; never required to *start* a SNAP application).
6. **Eligibility determination** — rules processing; `submitted → in_review → pending_info | approved | denied`.
7. **Case assignment** — routing by county, language, workload.
8. **Interview scheduling** — self-service scheduling + reminders (the biggest procedural-denial chokepoint).
9. **Adjudication** — approval/denial with reason codes (distinguish financial ineligibility vs. procedural denial).
10. **Benefit issuance** — out of scope for a navigator; reflect status only if available.
11. **Notification** — see §2.3.
12. **Status tracking** — applicant-visible timeline (or deep link to state portal).
13. **Renewal / recertification** — reminders, ex parte where allowed (largest source of avoidable benefit loss).
14. **Change reporting** — simple mobile-friendly change form.
15. **Appeals** — appeals form, evidence upload, status tracking.

### 2.3 Notification & communication requirements

- **Channels:** SMS (primary — ~98% open rate, works on low-end phones), email (secondary), in-app status, voice/IVR for accessibility, postal mail for legally-required official notices.
- **Notification types:** application received confirmation, missing-document request, interview reminders (48h/24h/1h), status updates, approval/denial notices (with appeal rights), benefit issuance, recertification reminders (60/30/14/7/1 days), change-reporting prompts, deadline warnings.
- **Content:** plain language, action-first ("Submit your pay stub by Fri Nov 14 to keep your case open: [link]"), language-matched to the user.
- **Two-way:** support replies with auto-responder routing to the right human channel; STOP/UNSUBSCRIBE and clear sender identification (TCPA).
- **Preferences:** explicit opt-in for SMS, channel/language/frequency controls, honor STOP immediately.
- **Reliability:** use a reputable provider with delivery receipts; log failures and surface to staff; retry on transient failure.
- **Evidence to cite:** Louisiana's LA'MESSAGE SMS pilot produced a 79% increase in kept WIC appointments, a 37% increase in SNAP renewals, and a 67% increase in Medicaid renewals; scaled to 50M+ messages and all 400,000+ Louisiana SNAP households.

### 2.4 Reporting & analytics requirements

Build analytics from day one — you cannot improve what you don't measure.

- **Funnel / conversion analytics (P0):** drop-off at each stage (landing → screener started → screener completed → application started → submitted → documents complete → determined → issued). MNbenefits' funnel analysis raised Spanish-speaker completion from 51% to 64%.
- **Completion & time metrics:** completion rate, median time-to-completion, session counts; segment by language, household type, device.
- **Approval / denial / procedural-denial rates** with granular reason codes — procedural-denial rate is the key equity metric.
- **Churn / recertification rates** and (where applicable) ex parte renewal rate.
- **Screener-to-application conversion.**
- **Demographic & equity analytics** — disaggregate every funnel metric to catch disparate impact; measure the participation gap.
- **Document submission metrics** — % submitted within 24h of request, rejection rate and reasons.
- **Notification effectiveness** — delivery, open/click, action-completion, A/B results.
- **Caseworker workload dashboards** (if admin features exist).
- **A/B testing / experimentation** infrastructure (feature flags + cohort assignment + outcome logging).
- **Accessibility metrics** — automated issues per page trend; manual audit cadence.
- **User satisfaction** — one-question post-flow micro-survey.
- **Operational KPIs** — uptime (target 99.9%), page load (LCP < 2.5s on 3G), error rate.
- **Privacy in analytics** — aggregate only; suppress small cells (k-anonymity); separate PII store from analytics store; no third-party tracking pixels on PII pages.
- **"Vital signs" dashboard** (CBPP-aligned): application volume, % within SLA, procedural-denial rate, ex parte rate, churn rate, satisfaction, median time-to-completion, funnel drop-off.

---

## 3. Technical Requirements

### 3.1 Security

**Baseline, in priority order:**

| Priority | Control | Implementation |
|---|---|---|
| P0 | TLS 1.2+ everywhere | Let's Encrypt; enforce HSTS |
| P0 | No PII persisted server-side | Session-only state; never collect SSN or document numbers |
| P0 | OWASP Top 10 (2025) hygiene | Modern framework defaults; npm audit / pip-audit in CI |
| P0 | Security headers (CSP, HSTS, X-Frame-Options) | helmet.js or equivalent |
| P0 | Parameterized queries / ORM only | No string-concatenated SQL |
| P0 | Written plain-language privacy notice | What you collect, why, how long |
| P1 | Dependency scanning in CI | Dependabot / Snyk |
| P1 | Centralized logging, PII redacted at source | — |
| P1 | If accounts exist: Argon2id/bcrypt + TOTP MFA | Don't rely on SMS as primary MFA |
| P1 | Secrets in env vars / vault | .env in .gitignore; pre-commit secret scan |
| P2 | One-page threat model (STRIDE) | — |
| P2 | SAST | Semgrep free tier |
| P3 | NIST 800-53 Moderate "aspires-to" mapping | 1-page doc only |

**Production stack (document as out-of-scope, P3):** FISMA / NIST 800-53 Moderate (287 controls), FedRAMP or StateRAMP/GovRAMP cloud authorization, IRS Publication 1075 (mock), NIST SP 800-63-4 identity assurance (IAL2/AAL2 phishing-resistant), formal pen test, 24×7 monitoring, incident response retainer.

### 3.2 Accessibility

- **Standard:** WCAG 2.1 Level AA (the de facto national floor; required by the DOJ Title II rule — compliance April 26, 2027 for entities serving 50,000+ — and the HHS Section 504 digital rule — compliance May 11, 2027). Section 508 still cites WCAG 2.0 AA; design to 2.1 AA.
- **P0 build decision:** adopt the U.S. Web Design System (USWDS) for all components — it ships WCAG 2.1 AA-tested forms, color tokens, date pickers, file inputs, and step indicators.
- **Specific must-pass criteria:** alt text (1.1.1), semantic structure and labeled inputs (1.3.1), 4.5:1 text contrast (1.4.3), 200% zoom (1.4.4), keyboard operability with no traps (2.1.1), visible focus (2.4.7), page language (3.1.1), clear error identification and suggestions (3.3.1 / 3.3.3), correct name/role/value on custom widgets (4.1.2).
- **LEP / low digital literacy:** plain language (6th–8th grade), Spanish at minimum, one question per screen, visible progress, save-without-account.
- **Testing stack:** axe-core in CI on every PR; Lighthouse weekly; manual keyboard pass and NVDA/VoiceOver walkthrough on the top 5 flows before each release; WebAIM contrast checks at design time; 200%/400% zoom test. (Automation catches roughly half of real issues — manual testing remains essential.)

### 3.3 Data retention & privacy

A screener is **not** the system of record; retain as little as possible.

| Data | Retain? | How long |
|---|---|---|
| SSN | Never collect | — |
| Full name / address | Avoid unless needed for a referral | — |
| Household composition (anonymous) | Session only | ≤ 24h |
| Income (range or value) | Session only | Session lifetime |
| Immigration status (categorical / yes-no-unsure only; never document numbers) | Session only | Session lifetime |
| Email (only if user opts in to save/resume) | With explicit consent | Default 30 days, max 90 |
| Aggregate analytics (county, language, programs, outcome counts) | Yes, fully anonymized | 1–3 years |
| Admin audit log | Yes | ≥ 1 year |

- **Best practices:** data minimization (every field justified by a rule), right-to-delete on demand, secure destruction (NIST SP 800-88), explicit logged consent for any sharing, no tracking pixels on PII pages, privacy-respecting analytics (Plausible/Fathom) configured to strip PII.
- **Production context (P3):** SNAP records 3 years (7 CFR 272.1(f)(1)); Medicaid per 42 CFR 431.17; TANF/WIC/federal grants generally 3 years; Privacy Act of 1974 (federal SORN); program-specific confidentiality (7 CFR 272.1(c) for SNAP).

### 3.4 Integrations

Put every external dependency behind a port/adapter so stubs are honest and swappable.

| System | Approach |
|---|---|
| PolicyEngine API (benefit calculations) | **Real** — core differentiator |
| HSDS / 211 resource directory | **Real** — public dataset |
| USPS address verification | **Real** — free Web Tools account |
| Twilio SMS | **Real** — dev mode, behind `NotificationService` |
| SendGrid / SES email | **Real** — behind `NotificationService` |
| Login.gov | **Real sandbox** (no real PII) or mock OIDC |
| Federal Data Services Hub, SSA SOLQ/SVES, IRS income, DHS SAVE, The Work Number, state wage DBs | **Mock** behind a single `VerificationService` interface |
| State EBT / payment systems | **Out of scope** |
| Findhelp / Unite Us | **Mock** (no public sandbox) |
| Document OCR | **Mock**, or AWS Textract free tier for a demo |

**Recommended layered architecture**

```
[ Browser (USWDS UI) ]
        |
[ App Server (Django / Rails / Next.js) ]
        |
[ Domain Services Layer ]
   ├── EligibilityService  ──► PolicyEngine API (real)
   ├── VerificationService ──► Mock adapters (FDSH/SAVE/SSA stubs)
   ├── ReferralService     ──► HSDS adapter (real, public dataset)
   ├── NotificationService ──► Twilio + SendGrid (real, dev mode)
   ├── AddressService      ──► USPS Web Tools (real)
   └── IdentityService     ──► Login.gov sandbox (real) OR mock-OIDC
        |
[ Data Layer (Postgres) ]
   - Sessions (short-lived)
   - Aggregate analytics (anonymized)
   - Saved-resume tokens (opt-in, 30-day TTL)
```

**Integration challenges to acknowledge in the design doc:** legacy mainframes (batch FTP, middleware needed), batch vs. real-time data, fuzzy data matching (no national person identifier), rate limits/SLAs (retry with backoff, circuit breakers), certificate rotation.

---

## 4. AI Enhancements

The AI layer is the project's core value proposition. The governing principle across all AI features: **AI assists, humans decide.** Never put an LLM in the eligibility-math path, and always provide a human/escalation route. (This section draws on prior research; the dedicated AI deep-dive should be rerun to expand and add citations.)

### 4.1 Automating eligibility workflows
- **Use deterministic rules-as-code for the actual eligibility math** (PolicyEngine or an encoded rules file) — auditable, explainable, testable. ML and LLMs are *not* appropriate here.
- **Automated/ex parte renewals (P2, mostly production):** Code for America reduced a Minnesota renewal task from 70 minutes to 11 (80% reduction) via automated renewals; a CMS/USDS intervention across four large states raised ex parte renewal rates ~21.6 points and cut procedural denials ~8.3 points. 
- **Caseworker decision support (P2):** AI summarizes a case or flags missing items for a human — never auto-denies.
- **Guardrails (P0):** learn from failures — Michigan's MiDAS and Australia's Robodebt automated wrongful denials at scale. Require human-in-the-loop for any adverse action, explainable outputs, and bias testing. Align to the NIST AI Risk Management Framework.

### 4.2 Document processing
- **Intelligent document processing (P1):** OCR + extraction from pay stubs, IDs, utility bills, leases. Real services: AWS Textract, Google Document AI, Azure Document Intelligence.
- **Always human-in-the-loop:** show extracted values for user/caseworker confirmation; never block submission on OCR failure (OCR is assistive only).
- **Impact evidence:** Nava's Vermont document uploader — 46% of users submitted documents within 24 hours of a request vs. 6% baseline, and time-to-determination fell 44%; Civilla's Michigan redesign tripled document submissions.
- **Approach:** mock OCR, or wire AWS Textract free tier for a single demo flow; never store sensitive documents server-side beyond the session.

### 4.3 Chatbot / conversational AI
- **Use case (P1):** a claimant-facing navigator that answers "Am I eligible if…?", explains requirements in plain language, guides the application, and supports multiple languages 24/7 — reducing call-center load.
- **Architecture:** retrieval-augmented generation (RAG) over a curated, vetted knowledge base of program rules. **Every answer cites its source passage** (Nava's pattern).
- **Guardrails (P0):** always offer "talk to a human"; disclaim that it's an AI assistant; never let the bot make or imply an eligibility *decision*. Nava found chatbot accuracy "highly variable," requiring significant engineering — so scope conservatively.
- **Evidence:** Nava + Imagine LA piloted an AI assistant for navigators serving ~10,000 households; mRelief is building an AI application-assistant on top of its existing chatbot.
- **Approach:** RAG over rules knowledge base using an LLM API; keep it assistive and clearly bounded.

### 4.4 Predictive analytics
- **Highest-value, lowest-risk uses (P2):** predict application *abandonment / drop-off* to trigger a helpful nudge; predict *recertification/churn risk* to send proactive reminders; identify *eligible-but-not-enrolled* populations for targeted outreach (where the largest impact lives — e.g., the ~18% SNAP gap, ~9M under-enrolled seniors).
- **Caseload forecasting (P2):** predict volume to allocate staff.
- **High-risk, avoid or treat with extreme caution:** fraud / improper-payment models that can cause wrongful denials. MiDAS and Robodebt are cautionary tales. If touched at all, require transparency, explainability, human review, and disparate-impact testing.
- **Equity requirement (P0 for any model):** measure predictions for bias across demographic groups; never deploy a model whose errors fall disproportionately on protected groups.
- **Approach:** demonstrate a *simple, transparent* drop-off or churn-risk indicator on synthetic/aggregate data to drive a reminder — not a real determination or fraud model.