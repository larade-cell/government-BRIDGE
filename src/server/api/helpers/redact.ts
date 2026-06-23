/**
 * Mask Social Security numbers in free text before it is persisted.
 *
 * OCR of an SSN card — and of many benefit/tax documents — yields the raw SSN,
 * and the AI's summaries/verdicts can echo it back. Storing any of that
 * verbatim would put a plaintext SSN in the database. We redact at every write
 * point instead.
 *
 * This deliberately over-redacts stored text: masking an occasional unrelated
 * 9-digit number is an acceptable trade for never persisting a real SSN. The
 * raw text is still used in-memory (e.g. for classification) before redaction;
 * only what we keep is masked.
 */
const SSN_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // 123-45-6789
  /\b\d{3}\s\d{2}\s\d{4}\b/g, // 123 45 6789
  /\b\d{9}\b/g, // 123456789 (no separators)
];

const SSN_MASK = "***-**-****";

/**
 * Replace SSN-shaped substrings with a fixed mask. Returns the input unchanged
 * when it isn't a string (so it composes with nullable DB columns).
 */
export function redactSsn<T extends string | null | undefined>(text: T): T {
  if (typeof text !== "string") return text;
  let out: string = text;
  for (const re of SSN_PATTERNS) out = out.replace(re, SSN_MASK);
  return out as T;
}
