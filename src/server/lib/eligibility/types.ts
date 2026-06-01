/**
 * Rule-engine types.
 *
 * A program's eligibility is expressed as a set of `Criterion`s, each backed by
 * a `Condition` tree evaluated against `Facts` derived from the resident's
 * screening answers. Conditions use three-valued logic (met / unmet / unknown)
 * so a missing answer never silently reads as a failure.
 *
 * Kept dependency-free (no `~` alias imports, no zod) so `prisma/seed.ts` can
 * import the rule definitions directly under tsx.
 */

export type Operator =
  | "eq"
  | "ne"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "nin";

export type Scalar = number | string | boolean;

/** A single comparison against one derived fact. */
export interface Leaf {
  fact: string;
  op: Operator;
  value: Scalar | Scalar[];
}

export interface AllGroup {
  all: Condition[];
}
export interface AnyGroup {
  any: Condition[];
}
export interface NotGroup {
  not: Condition;
}

export type Condition = Leaf | AllGroup | AnyGroup | NotGroup;

export interface Criterion {
  /** Stable identifier, unique within a program's requirement list. */
  key: string;
  /**
   * Categorical disqualifier. A failed `hard` criterion (e.g. "must have a
   * child under 18") means the resident is clearly outside the program, so
   * the false-positive bias does not rescue it. A failed soft criterion
   * (typically an income threshold near the line) does.
   */
  hard?: boolean;
  condition: Condition;
  /** Requirement phrased positively, for the met/unknown explanation lines. */
  label_en: string;
  label_es: string;
  /** Optional explicit phrasing when the criterion is NOT met. */
  unmet_en?: string;
  unmet_es?: string;
}

/**
 * State-specific variation of a program's requirements. Programs like SNAP and
 * Medicaid differ by state (broad-based categorical eligibility, Medicaid
 * expansion, etc.). When the resident's `state` fact matches a key in
 * `ProgramRules.states`, these are merged onto the base requirements.
 */
export interface StateRules {
  /** Admin/resident-facing explanation of how this state differs. */
  note?: string;
  /** Criteria that replace a base requirement with the same `key`. */
  override?: Criterion[];
  /** Extra criteria that only apply to residents of this state. */
  add?: Criterion[];
}

export interface ProgramRules {
  /** Maintainer note on the screening basis (federal heuristic, % FPL, etc.). */
  summary?: string;
  requirements: Criterion[];
  /** Per-state overrides, keyed by 2-letter state code (uppercase). */
  states?: Record<string, StateRules>;
}

export type FactValue = number | string | boolean | undefined;
export type Facts = Record<string, FactValue>;

export type EvalStatus = "met" | "unmet" | "unknown";

export type EligibilityOutcome =
  | "likely_eligible"
  | "may_be_eligible"
  | "unlikely_eligible"
  | "needs_more_info";

export interface CriterionResult {
  key: string;
  status: EvalStatus;
  hard: boolean;
  label_en: string;
  label_es: string;
}

export interface ProgramEvaluation {
  outcome: EligibilityOutcome;
  /** English statements stored in `explanation.reasons` (AI explainer input). */
  reasons: string[];
  /** Structured per-criterion results, for future localized rendering. */
  criteria: CriterionResult[];
  /** State code whose specific rules were applied, if any. */
  applied_state?: string | null;
}
