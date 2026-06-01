/**
 * The rule engine: evaluate a program's requirements against derived facts and
 * resolve a single eligibility outcome plus a human-readable explanation.
 *
 * Three-valued logic: every condition is met, unmet, or unknown. `unknown`
 * propagates so a missing answer produces "needs more information" rather than
 * a false rejection.
 */
import type {
  Condition,
  Criterion,
  CriterionResult,
  EligibilityOutcome,
  EvalStatus,
  Facts,
  Leaf,
  ProgramEvaluation,
  ProgramRules,
  Scalar,
} from "./types";

/**
 * Resolve the requirements that actually apply to a resident, merging the
 * program's base requirements with any state-specific variation. `override`
 * entries replace a base requirement with the same `key` (or append if none
 * matches); `add` entries are appended. Returns the applied state + its note
 * when a variation was used, for transparency in the explanation and admin UI.
 */
export function effectiveRequirements(
  rules: ProgramRules,
  state: string | undefined,
): { requirements: Criterion[]; appliedState?: string; note?: string } {
  const base = [...rules.requirements];
  const stateRules = state && rules.states ? rules.states[state] : undefined;
  if (!stateRules) return { requirements: base };

  const requirements = [...base];
  for (const ov of stateRules.override ?? []) {
    const idx = requirements.findIndex((r) => r.key === ov.key);
    if (idx >= 0) requirements[idx] = ov;
    else requirements.push(ov);
  }
  requirements.push(...(stateRules.add ?? []));
  return { requirements, appliedState: state, note: stateRules.note };
}

function compare(actual: Scalar, op: Leaf["op"], value: Scalar | Scalar[]): boolean {
  switch (op) {
    case "eq":
      return actual === value;
    case "ne":
      return actual !== value;
    case "lt":
      return typeof actual === "number" && typeof value === "number" && actual < value;
    case "lte":
      return typeof actual === "number" && typeof value === "number" && actual <= value;
    case "gt":
      return typeof actual === "number" && typeof value === "number" && actual > value;
    case "gte":
      return typeof actual === "number" && typeof value === "number" && actual >= value;
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "nin":
      return Array.isArray(value) && !value.includes(actual);
    default:
      return false;
  }
}

function evalLeaf(leaf: Leaf, facts: Facts): EvalStatus {
  const actual = facts[leaf.fact];
  if (actual === undefined) return "unknown";
  return compare(actual, leaf.op, leaf.value) ? "met" : "unmet";
}

/** Evaluate a condition tree under three-valued (Kleene) logic. */
export function evalCondition(cond: Condition, facts: Facts): EvalStatus {
  if ("all" in cond) {
    let unknown = false;
    for (const c of cond.all) {
      const s = evalCondition(c, facts);
      if (s === "unmet") return "unmet";
      if (s === "unknown") unknown = true;
    }
    return unknown ? "unknown" : "met";
  }
  if ("any" in cond) {
    let unknown = false;
    for (const c of cond.any) {
      const s = evalCondition(c, facts);
      if (s === "met") return "met";
      if (s === "unknown") unknown = true;
    }
    return unknown ? "unknown" : "unmet";
  }
  if ("not" in cond) {
    const s = evalCondition(cond.not, facts);
    return s === "met" ? "unmet" : s === "unmet" ? "met" : "unknown";
  }
  return evalLeaf(cond, facts);
}

/** Lower weight sorts first — best-matched programs at the top of the list. */
export const OUTCOME_WEIGHT: Record<EligibilityOutcome, number> = {
  likely_eligible: 0,
  may_be_eligible: 1,
  needs_more_info: 2,
  unlikely_eligible: 3,
};

function reasonFor(c: CriterionResult, unmetOverride?: string): string {
  switch (c.status) {
    case "met":
      return c.label_en;
    case "unmet":
      return unmetOverride ?? `Your answers suggest you may not meet: ${c.label_en}`;
    case "unknown":
      return `More information needed: ${c.label_en}`;
  }
}

/**
 * Evaluate every requirement and resolve the outcome.
 *
 * - any hard requirement unmet      → unlikely_eligible (categorically out)
 * - else a soft requirement unmet   → may_be_eligible (bias) | unlikely_eligible
 * - else something unknown          → may_be_eligible (bias) | needs_more_info
 * - else all met                    → likely_eligible
 *
 * `bias` is the rule version's `false_positive_bias`: prefer surfacing a
 * program over wrongly screening someone out.
 */
export function evaluateProgram(
  rules: ProgramRules,
  facts: Facts,
  bias: boolean,
): ProgramEvaluation {
  const state = typeof facts.state === "string" ? facts.state : undefined;
  const { requirements, appliedState, note } = effectiveRequirements(rules, state);

  const evaluated = requirements.map((r) => ({
    result: {
      key: r.key,
      status: evalCondition(r.condition, facts),
      hard: r.hard ?? false,
      label_en: r.label_en,
      label_es: r.label_es,
    } satisfies CriterionResult,
    unmet_en: r.unmet_en,
  }));

  const criteria = evaluated.map((e) => e.result);
  const hardFail = criteria.some((c) => c.hard && c.status === "unmet");
  const softFail = criteria.some((c) => !c.hard && c.status === "unmet");
  const anyUnknown = criteria.some((c) => c.status === "unknown");

  let outcome: EligibilityOutcome;
  if (hardFail) {
    outcome = "unlikely_eligible";
  } else if (softFail) {
    outcome = bias ? "may_be_eligible" : "unlikely_eligible";
  } else if (anyUnknown) {
    outcome = bias ? "may_be_eligible" : "needs_more_info";
  } else {
    outcome = "likely_eligible";
  }

  const reasons = evaluated.map((e) => reasonFor(e.result, e.unmet_en));
  if (appliedState && note) {
    reasons.unshift(`Adjusted for your state (${appliedState}): ${note}`);
  }

  return { outcome, reasons, criteria, applied_state: appliedState ?? null };
}
