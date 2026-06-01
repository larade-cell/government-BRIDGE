/**
 * Turns raw screening answers (keyed by `question_key`) into the derived facts
 * that rule conditions reference. Anything that can't be parsed is left
 * `undefined`, which conditions treat as "unknown" rather than a failure.
 */
import { fplPercent } from "./fpl";
import type { Facts } from "./types";

/** Immigration statuses generally treated as qualified for federal benefits. */
export const QUALIFIED_STATUSES = [
  "us_citizen",
  "permanent_resident",
  "refugee_or_asylee",
  "other_qualified",
];

function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

/**
 * @param answers map of `question_key` → stored `answer_value`
 */
export function buildFacts(answers: Record<string, unknown>): Facts {
  const householdSize = asNumber(answers.household_size);
  const numChildren = asNumber(answers.num_children_under_18);
  const numSeniors = asNumber(answers.num_adults_60_plus);
  const age = asNumber(answers.applicant_age);
  const monthlyIncome = asNumber(answers.monthly_household_income);
  const earned = asNumber(answers.monthly_earned_income);
  const unearned = asNumber(answers.monthly_unearned_income);
  const assets = asNumber(answers.household_assets);
  const citizenship = asString(answers.citizenship_status);

  const annualIncome =
    monthlyIncome === undefined ? undefined : monthlyIncome * 12;
  const incomePctFpl =
    annualIncome !== undefined && householdSize !== undefined
      ? fplPercent(annualIncome, householdSize)
      : undefined;

  return {
    household_size: householdSize,
    num_children: numChildren,
    num_adults_60_plus: numSeniors,
    age,
    monthly_income: monthlyIncome,
    annual_income: annualIncome,
    earned_income: earned,
    unearned_income: unearned,
    assets,
    income_pct_fpl: incomePctFpl,
    citizenship,
    is_citizen_or_qualified:
      citizenship === undefined
        ? undefined
        : QUALIFIED_STATUSES.includes(citizenship),
    is_pregnant: asBoolean(answers.is_pregnant),
    has_disability: asBoolean(answers.has_disability),
    is_veteran: asBoolean(answers.is_veteran),
    is_student: asBoolean(answers.is_college_student),
    employment_status: asString(answers.employment_status),
    housing_status: asString(answers.housing_status),
    behind_on_utilities: asBoolean(answers.behind_on_utilities),
    has_high_medical_expenses: asBoolean(answers.has_high_medical_expenses),
    pays_dependent_care: asBoolean(answers.pays_dependent_care),
    filed_taxes: asBoolean(answers.filed_taxes_last_year),
    has_children: numChildren === undefined ? undefined : numChildren > 0,
    is_senior: age === undefined ? undefined : age >= 65,
  };
}
