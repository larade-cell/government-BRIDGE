/**
 * Bridges the guided rule editor and the rules-engine JSON.
 *
 * `serializeRules` turns the form model into the `ProgramRules`-shaped object
 * the engine stores; `parseRules` does the reverse so an existing version can be
 * loaded back into the form. Anything the guided form can't represent (e.g. the
 * per-state `states` overrides, or an unexpected shape) is preserved verbatim in
 * `passthrough` and merged back on save, and `parseRules` reports `ok: false` so
 * the caller can fall back to raw-JSON editing instead of losing data.
 */
import {
  FACT_BY_NAME,
  type OperatorName,
} from "~/server/lib/eligibility/factCatalog";
import type {
  Condition,
  Criterion,
  Scalar,
} from "~/server/lib/eligibility/types";

export type CondNode =
  | { t: "leaf"; fact: string; op: OperatorName; value: string }
  | { t: "all"; children: CondNode[] }
  | { t: "any"; children: CondNode[] }
  | { t: "not"; child: CondNode };

export interface FormCriterion {
  key: string;
  hard: boolean;
  label_en: string;
  label_es: string;
  unmet_en: string;
  condition: CondNode;
}

export interface RuleForm {
  summary: string;
  requirements: FormCriterion[];
}

export interface ParseResult {
  form: RuleForm;
  /** Top-level keys other than summary/requirements (e.g. `states`), preserved. */
  passthrough: Record<string, unknown>;
  /** False when the JSON couldn't be fully represented in the guided form. */
  ok: boolean;
}

export const EMPTY_FORM: RuleForm = { summary: "", requirements: [] };

/** A fresh leaf condition for a new requirement. */
export function newLeaf(): CondNode {
  return { t: "leaf", fact: "income_pct_fpl", op: "lte", value: "" };
}

export function newRequirement(): FormCriterion {
  return {
    key: "",
    hard: false,
    label_en: "",
    label_es: "",
    unmet_en: "",
    condition: newLeaf(),
  };
}

// ── serialize: form → engine JSON ──────────────────────────────────────────

function coerceValue(fact: string, op: string, raw: string): Scalar | Scalar[] {
  const type = FACT_BY_NAME[fact]?.type ?? "string";
  const one = (s: string): Scalar => {
    const t = s.trim();
    if (type === "number") {
      const n = Number(t);
      return Number.isFinite(n) && t !== "" ? n : t;
    }
    if (type === "boolean") return t === "true";
    return t;
  };
  if (op === "in" || op === "nin") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(one);
  }
  return one(raw);
}

function serializeCond(node: CondNode): Condition {
  if (node.t === "leaf") {
    return {
      fact: node.fact,
      op: node.op,
      value: coerceValue(node.fact, node.op, node.value),
    };
  }
  if (node.t === "all") return { all: node.children.map(serializeCond) };
  if (node.t === "any") return { any: node.children.map(serializeCond) };
  return { not: serializeCond(node.child) };
}

export function serializeRules(
  form: RuleForm,
  passthrough: Record<string, unknown> = {},
): Record<string, unknown> {
  const requirements: Criterion[] = form.requirements.map((c) => ({
    key: c.key.trim(),
    ...(c.hard ? { hard: true } : {}),
    condition: serializeCond(c.condition),
    label_en: c.label_en.trim(),
    label_es: c.label_es.trim(),
    ...(c.unmet_en.trim() ? { unmet_en: c.unmet_en.trim() } : {}),
  }));
  return {
    ...passthrough,
    ...(form.summary.trim() ? { summary: form.summary.trim() } : {}),
    requirements,
  };
}

// ── parse: engine JSON → form ──────────────────────────────────────────────

function scalarToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return ""; // objects/null/undefined have no friendly leaf representation
}

function valueToString(v: unknown): string {
  if (Array.isArray(v)) return v.map(scalarToString).join(", ");
  return scalarToString(v);
}

function parseCond(c: unknown): CondNode | null {
  if (!c || typeof c !== "object") return null;
  const o = c as Record<string, unknown>;
  if ("fact" in o && "op" in o) {
    return {
      t: "leaf",
      fact: String(o.fact),
      op: o.op as OperatorName,
      value: valueToString(o.value),
    };
  }
  if (Array.isArray(o.all)) {
    const ch = o.all.map(parseCond);
    return ch.every(Boolean) ? { t: "all", children: ch as CondNode[] } : null;
  }
  if (Array.isArray(o.any)) {
    const ch = o.any.map(parseCond);
    return ch.every(Boolean) ? { t: "any", children: ch as CondNode[] } : null;
  }
  if ("not" in o) {
    const child = parseCond(o.not);
    return child ? { t: "not", child } : null;
  }
  return null;
}

function parseCriterion(r: unknown): FormCriterion | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const condition = parseCond(o.condition);
  if (!condition) return null;
  return {
    key: typeof o.key === "string" ? o.key : "",
    hard: o.hard === true,
    label_en: typeof o.label_en === "string" ? o.label_en : "",
    label_es: typeof o.label_es === "string" ? o.label_es : "",
    unmet_en: typeof o.unmet_en === "string" ? o.unmet_en : "",
    condition,
  };
}

export function parseRules(rulesJson: unknown): ParseResult {
  if (!rulesJson || typeof rulesJson !== "object" || Array.isArray(rulesJson)) {
    return { form: { ...EMPTY_FORM }, passthrough: {}, ok: false };
  }
  const obj = rulesJson as Record<string, unknown>;
  let ok = true;

  const summary = typeof obj.summary === "string" ? obj.summary : "";
  let requirements: FormCriterion[] = [];
  if (Array.isArray(obj.requirements)) {
    for (const r of obj.requirements) {
      const parsed = parseCriterion(r);
      if (parsed) requirements.push(parsed);
      else ok = false; // a requirement we can't represent → offer raw JSON
    }
  } else if ("requirements" in obj) {
    ok = false;
    requirements = [];
  }

  const passthrough: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k !== "summary" && k !== "requirements") passthrough[k] = v;
  }

  return { form: { summary, requirements }, passthrough, ok };
}
