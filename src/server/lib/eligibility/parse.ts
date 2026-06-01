/**
 * Runtime validation of `eligibility_rule_versions.rules_json` into the typed
 * `ProgramRules` shape. Rows that don't match (legacy placeholder seeds,
 * hand-entered admin drafts) return `null`, and the caller falls back to a
 * conservative "needs more information" outcome rather than throwing.
 */
import { z } from "zod";

import type { Condition, ProgramRules } from "./types";

const scalar = z.union([z.number(), z.string(), z.boolean()]);

const leaf = z.object({
  fact: z.string(),
  op: z.enum(["eq", "ne", "lt", "lte", "gt", "gte", "in", "nin"]),
  value: z.union([scalar, z.array(scalar)]),
});

const condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    leaf,
    z.object({ all: z.array(condition) }),
    z.object({ any: z.array(condition) }),
    z.object({ not: condition }),
  ]),
);

const criterion = z.object({
  key: z.string(),
  hard: z.boolean().optional(),
  condition,
  label_en: z.string(),
  label_es: z.string(),
  unmet_en: z.string().optional(),
  unmet_es: z.string().optional(),
});

const stateRules = z.object({
  note: z.string().optional(),
  override: z.array(criterion).optional(),
  add: z.array(criterion).optional(),
});

const programRules = z.object({
  summary: z.string().optional(),
  requirements: z.array(criterion).min(1),
  states: z.record(z.string(), stateRules).optional(),
});

/** Returns typed rules, or `null` when `rules_json` is not in the rule format. */
export function parseProgramRules(rulesJson: unknown): ProgramRules | null {
  const parsed = programRules.safeParse(rulesJson);
  return parsed.success ? parsed.data : null;
}
