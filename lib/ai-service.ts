import OpenAI from "openai";

import { env } from "~/env";

// NB: intentionally no `import "server-only"`. This module is only ever
// imported by server code (tRPC routers), and the test suite imports the
// router graph under Node — where `server-only` resolves to its throwing
// build and would crash the suite. Keep all imports of this file server-side.

/**
 * ai-service — the single chokepoint for every LLM / embedding call in the app.
 *
 * Nothing else should import the `openai` SDK directly. Routers and server code
 * call the typed helpers below so that model choice, prompting, grounding rules,
 * and graceful degradation all live in one place.
 *
 * Design constraints carried over from ai-features.md:
 *  - AI is an assistive layer; it is NEVER the source of truth for eligibility.
 *  - User-facing free text is RAG-grounded: the model answers only from the
 *    passages it is given and refuses (offering human handoff) when retrieval is
 *    insufficient, rather than drawing on its own pretraining knowledge.
 *  - Every answer carries citations back to the source passages.
 *
 * Graceful degradation: when `OPENAI_API_KEY` is not configured (dev, CI, test)
 * every call returns `null` instead of throwing. Callers treat `null` as
 * "AI unavailable" and fall back to their deterministic behaviour, so the app —
 * and the test suite — keeps working without a key.
 */

// ---------------------------------------------------------------------------
// Models — centralized so a model bump is a one-line change.
// ---------------------------------------------------------------------------

export const CHAT_MODEL = "gpt-4o-mini";
export const EMBEDDING_MODEL = "text-embedding-3-small";
/** Dimensionality produced by EMBEDDING_MODEL — useful for sizing pgvector columns. */
export const EMBEDDING_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Resilience — timeouts and retries.
// ---------------------------------------------------------------------------

/** Per-request timeout (ms). The SDK aborts and (within MAX_RETRIES) retries a
 * request that exceeds this. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Vision/OCR requests are heavier, so they get a longer per-request timeout. */
const VISION_TIMEOUT_MS = 60_000;
/**
 * Automatic retries with exponential backoff, handled by the SDK. It retries
 * connection errors and HTTP 408/409/429/>=500, honoring any `Retry-After`
 * header. Total attempts per call = MAX_RETRIES + 1.
 */
const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// Client singleton (mirrors src/server/db.ts so dev hot-reload reuses one).
// ---------------------------------------------------------------------------

const globalForAi = globalThis as unknown as {
  openai: OpenAI | undefined;
};

function getClient(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  const client =
    globalForAi.openai ??
    new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: MAX_RETRIES,
    });
  if (env.NODE_ENV !== "production") globalForAi.openai = client;
  return client;
}

/** Whether AI features are wired up (an API key is present). */
export function isAiEnabled(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/** Log an OpenAI/SDK error (with HTTP status when present) without leaking the key. */
function logAiError(op: string, err: unknown): void {
  const detail =
    err instanceof OpenAI.APIError
      ? `${err.status ?? "no-status"} ${err.name}: ${err.message}`
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
  console.error(`[ai-service] ${op} failed after retries: ${detail}`);
}

/**
 * Run an OpenAI call with graceful degradation. The SDK handles timeouts and
 * retries internally; if those are exhausted (or any other error is thrown),
 * this logs and resolves to `null` so callers fall back to deterministic
 * behaviour instead of surfacing a 500.
 */
async function safeCall<T>(op: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logAiError(op, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A vetted knowledge-base passage retrieved for grounding an answer. */
export interface RetrievedPassage {
  /** Stable id of the source passage in the knowledge base. */
  source_id: string;
  title: string;
  url: string;
  content: string;
}

/**
 * Citation shape returned to clients — matches the ai router / DB contract.
 * Declared as a `type` (not `interface`) so it satisfies Prisma's
 * `InputJsonValue` when written to the `ai_messages.citations` Json column.
 */
export type Citation = {
  title: string;
  url: string;
  source_id: string | null;
};

/** A single turn of prior conversation, oldest-first. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
  /** True when the answer is supported by the supplied passages. */
  grounded: boolean;
  /** True when retrieval was insufficient and a human handoff should be offered. */
  handoff_recommended: boolean;
}

export interface DocumentClassification {
  /** `doc_key` of the best-matching document type, or null if none fit. */
  doc_key: string | null;
  /** Model confidence in [0, 1]. */
  confidence: number;
}

export interface DocumentAnalysis {
  /** Plain-text transcription of the document's readable content (OCR). */
  extracted_text: string;
  /** One- or two-sentence plain-language summary of what the document is. */
  summary: string;
  /** Free-text best guess at the document category (advisory, not a doc_key). */
  suggested_type: string | null;
}

// ---------------------------------------------------------------------------
// Embeddings — powers semantic program search and RAG retrieval.
// ---------------------------------------------------------------------------

/**
 * Embed one or more strings into vectors. Returns `null` when AI is disabled.
 * The returned array is index-aligned with `input`.
 */
export async function embedTexts(input: string[]): Promise<number[][] | null> {
  const client = getClient();
  if (!client || input.length === 0) return null;

  const res = await safeCall("embedTexts", () =>
    client.embeddings.create({ model: EMBEDDING_MODEL, input }),
  );
  if (!res) return null;
  // The API preserves request order, but sort by index to be safe.
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Convenience wrapper for a single string. */
export async function embedText(input: string): Promise<number[] | null> {
  const vectors = await embedTexts([input]);
  return vectors?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Grounded Q&A — the AI navigator / chatbot (Story 13).
// ---------------------------------------------------------------------------

const NAVIGATOR_SYSTEM_PROMPT = `You are a benefits navigator assistant for a public benefit-eligibility platform.

Strict rules:
- Answer ONLY using the information in the provided SOURCE PASSAGES. Do not use any outside or prior knowledge.
- If the passages do not contain enough information to answer, do not guess. Say you don't have that information and that the user can be connected to a person.
- You never make an official eligibility decision. Eligibility is determined by the administering agency; describe possibilities as general information only.
- Write in plain language at roughly a 6th-grade reading level.
- Cite the passages you used by their source_id.
- Respond in the requested language.

Return ONLY a JSON object with this exact shape:
{
  "answer": string,
  "used_source_ids": string[],   // source_ids of passages actually used; [] if you could not answer
  "answered": boolean            // false if the passages were insufficient
}`;

function buildPassageBlock(passages: RetrievedPassage[]): string {
  if (passages.length === 0) return "(no passages were retrieved)";
  return passages
    .map(
      (p) =>
        `[source_id: ${p.source_id}] ${p.title} (${p.url})\n${p.content}`,
    )
    .join("\n\n");
}

/**
 * Generate a RAG-grounded answer to a user question.
 *
 * Returns `null` when AI is disabled so the caller can fall back to its
 * deterministic stub. When the supplied passages are insufficient the result
 * has `grounded: false` and `handoff_recommended: true` rather than a guess.
 */
export async function generateGroundedAnswer(params: {
  question: string;
  passages: RetrievedPassage[];
  language_code: string;
  history?: ChatTurn[];
}): Promise<GroundedAnswer | null> {
  const client = getClient();
  if (!client) return null;

  const { question, passages, language_code, history = [] } = params;

  const completion = await safeCall("generateGroundedAnswer", () =>
    client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: NAVIGATOR_SYSTEM_PROMPT },
        ...history.map((t) => ({ role: t.role, content: t.content }) as const),
        {
          role: "user",
          content: [
            `Language: ${language_code}`,
            "",
            "SOURCE PASSAGES:",
            buildPassageBlock(passages),
            "",
            `QUESTION: ${question}`,
          ].join("\n"),
        },
      ],
    }),
  );
  if (!completion) return null;

  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;

  let parsed: { answer?: string; used_source_ids?: string[]; answered?: boolean };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    // Malformed model output — treat as a failed retrieval and hand off.
    return {
      answer: "",
      citations: [],
      grounded: false,
      handoff_recommended: true,
    };
  }

  const answered = parsed.answered !== false && Boolean(parsed.answer);
  const usedIds = new Set(parsed.used_source_ids ?? []);
  const citations: Citation[] = passages
    .filter((p) => usedIds.has(p.source_id))
    .map((p) => ({ title: p.title, url: p.url, source_id: p.source_id }));

  return {
    answer: parsed.answer ?? "",
    citations,
    grounded: answered && citations.length > 0,
    handoff_recommended: !answered || citations.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Document classification (Story 8/15) — assistive only; users can override.
// ---------------------------------------------------------------------------

const CLASSIFIER_SYSTEM_PROMPT = `You classify a benefits-application document into one of a fixed set of document types.

You are given OCR-extracted text and a list of candidate document types (each with a doc_key and description). Pick the single best-matching doc_key.

Return ONLY a JSON object: { "doc_key": string | null, "confidence": number }
- doc_key must be exactly one of the provided candidate keys, or null if none fit.
- confidence is your certainty in [0, 1].`;

/**
 * Classify a document from its OCR-extracted text against a known set of
 * document types. Returns `null` when AI is disabled. The result is advisory —
 * callers persist it as a suggestion the user can confirm or override.
 */
export async function classifyDocument(params: {
  text: string;
  candidates: { doc_key: string; description: string }[];
}): Promise<DocumentClassification | null> {
  const client = getClient();
  if (!client || params.candidates.length === 0) return null;

  const completion = await safeCall("classifyDocument", () =>
    client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "CANDIDATE DOCUMENT TYPES:",
            ...params.candidates.map((c) => `- ${c.doc_key}: ${c.description}`),
            "",
            "DOCUMENT TEXT:",
            params.text.slice(0, 8000),
          ].join("\n"),
        },
      ],
    }),
  );
  if (!completion) return null;

  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DocumentClassification;
    const validKeys = new Set(params.candidates.map((c) => c.doc_key));
    const doc_key =
      parsed.doc_key && validKeys.has(parsed.doc_key) ? parsed.doc_key : null;
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0;
    return { doc_key, confidence };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Document analysis (vision OCR) — read an uploaded image/scan directly.
// ---------------------------------------------------------------------------

const ANALYZER_SYSTEM_PROMPT = `You read an image of a benefits-application document and extract its contents.

Transcribe the readable text, then summarize in plain language what the document is. Do not invent information that is not visible in the image. Do not make eligibility decisions.

Return ONLY a JSON object: { "extracted_text": string, "summary": string, "suggested_type": string | null }
- extracted_text: the document's readable text, or "" if unreadable.
- summary: one or two short sentences describing the document.
- suggested_type: a short free-text category (e.g. "pay stub", "utility bill"), or null if unclear.`;

/**
 * Analyze a document image with the vision model: OCR-transcribe it and
 * summarize what it is. `imageUrl` may be a publicly reachable URL or a base64
 * `data:` URL. Returns `null` when AI is disabled. Advisory only — never a
 * source of truth for eligibility.
 */
export async function analyzeDocument(params: {
  imageUrl: string;
  language_code?: string;
}): Promise<DocumentAnalysis | null> {
  const client = getClient();
  if (!client) return null;

  const lang = params.language_code ?? "en";
  const completion = await safeCall("analyzeDocument", () =>
    client.chat.completions.create(
      {
        model: CHAT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYZER_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this document. Respond in ${lang}.`,
              },
              { type: "image_url", image_url: { url: params.imageUrl } },
            ],
          },
        ],
      },
      { timeout: VISION_TIMEOUT_MS },
    ),
  );
  if (!completion) return null;

  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DocumentAnalysis>;
    return {
      extracted_text:
        typeof parsed.extracted_text === "string" ? parsed.extracted_text : "",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      suggested_type:
        typeof parsed.suggested_type === "string" ? parsed.suggested_type : null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Eligibility explainer — turn a deterministic rules-engine outcome into a
// plain-language explanation. The rules engine OWNS the decision; AI only
// rephrases it. It must not change the outcome or invent new criteria.
// ---------------------------------------------------------------------------

export interface EligibilityExplanation {
  /** Plain-language paragraph explaining the outcome. */
  explanation: string;
  /** Short bullets naming what drove the outcome. */
  key_factors: string[];
  /** Suggested concrete next actions for the resident. */
  next_steps: string[];
}

const EXPLAINER_SYSTEM_PROMPT = `You help a resident understand a benefit-eligibility screening result.

The OUTCOME has already been decided by a deterministic rules engine — it is the source of truth. Your job is ONLY to explain it in plain language.

Strict rules:
- Do NOT change, second-guess, or re-derive the outcome. Restate it as given.
- Explain using ONLY the outcome and the REASONS provided. Do not invent eligibility criteria, dollar thresholds, or program rules that are not in the reasons.
- This is general information, never an official eligibility decision.
- Write warmly and plainly, around a 6th-grade reading level. Respond in the requested language.

Return ONLY a JSON object with this exact shape:
{
  "explanation": string,        // 2-4 sentences explaining what the result means
  "key_factors": string[],      // short phrases describing what mattered (may be [])
  "next_steps": string[]        // concrete actions the person can take (may be [])
}`;

/**
 * Explain an eligibility outcome in plain language. Returns `null` when AI is
 * disabled or the call fails (after retries/timeout) so the caller can fall
 * back to a deterministic explanation. The outcome is passed in, not decided
 * here — this function never determines eligibility.
 */
export async function explainEligibility(params: {
  program_name: string;
  outcome: string;
  outcome_label: string;
  reasons: string[];
  language_code: string;
}): Promise<EligibilityExplanation | null> {
  const client = getClient();
  if (!client) return null;

  const completion = await safeCall("explainEligibility", () =>
    client.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXPLAINER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Language: ${params.language_code}`,
            `Program: ${params.program_name}`,
            `Outcome (source of truth): ${params.outcome_label} (${params.outcome})`,
            "",
            "REASONS from the rules engine:",
            params.reasons.length
              ? params.reasons.map((r) => `- ${r}`).join("\n")
              : "- (no specific reasons were recorded)",
          ].join("\n"),
        },
      ],
    }),
  );
  if (!completion) return null;

  const raw = completion.choices[0]?.message.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<EligibilityExplanation>;
    if (typeof parsed.explanation !== "string" || !parsed.explanation.trim()) {
      return null;
    }
    const asStrings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    return {
      explanation: parsed.explanation,
      key_factors: asStrings(parsed.key_factors),
      next_steps: asStrings(parsed.next_steps),
    };
  } catch {
    return null;
  }
}
