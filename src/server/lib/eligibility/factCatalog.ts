/**
 * Human-friendly catalog of the facts that rule conditions can reference. Drives
 * the guided rule editor's field dropdown (label + type), so admins pick
 * "Income as % of the federal poverty line is at most 130" instead of writing
 * `{ "fact": "income_pct_fpl", "op": "lte", "value": 130 }` by hand.
 *
 * Keep in sync with `buildFacts` in facts.ts — every fact emitted there should
 * have an entry here (and vice versa).
 */

export type FactType = "number" | "boolean" | "string";

export interface FactMeta {
  /** The `fact` key used in a condition leaf. */
  name: string;
  /** Plain-language label shown in the editor. */
  label: string;
  type: FactType;
  /** Optional hint (e.g. units or example values). */
  help?: string;
}

export const FACT_CATALOG: FactMeta[] = [
  // Household / demographics
  { name: "household_size", label: "Household size", type: "number" },
  {
    name: "num_children",
    label: "Number of children under 18",
    type: "number",
  },
  { name: "num_adults_60_plus", label: "Adults 60 or older", type: "number" },
  { name: "age", label: "Applicant age", type: "number" },
  { name: "has_children", label: "Has children", type: "boolean" },
  { name: "is_senior", label: "Is 65 or older", type: "boolean" },
  // Income / assets
  {
    name: "income_pct_fpl",
    label: "Income as % of the federal poverty line",
    type: "number",
    help: "e.g. 130 means 130% of FPL",
  },
  {
    name: "monthly_income",
    label: "Monthly household income",
    type: "number",
    help: "US dollars",
  },
  {
    name: "annual_income",
    label: "Annual household income",
    type: "number",
    help: "US dollars",
  },
  {
    name: "earned_income",
    label: "Monthly earned income",
    type: "number",
    help: "US dollars",
  },
  {
    name: "unearned_income",
    label: "Monthly unearned income",
    type: "number",
    help: "US dollars",
  },
  {
    name: "assets",
    label: "Household assets",
    type: "number",
    help: "US dollars",
  },
  // Status / flags
  {
    name: "state",
    label: "State of residence",
    type: "string",
    help: "2-letter code, e.g. CA",
  },
  {
    name: "citizenship",
    label: "Citizenship / immigration status",
    type: "string",
    help: "e.g. us_citizen, permanent_resident",
  },
  {
    name: "is_citizen_or_qualified",
    label: "Is a citizen or qualified immigrant",
    type: "boolean",
  },
  { name: "employment_status", label: "Employment status", type: "string" },
  { name: "housing_status", label: "Housing status", type: "string" },
  { name: "is_pregnant", label: "Is pregnant", type: "boolean" },
  { name: "has_disability", label: "Has a disability", type: "boolean" },
  { name: "is_veteran", label: "Is a veteran", type: "boolean" },
  { name: "is_student", label: "Is a college student", type: "boolean" },
  {
    name: "behind_on_utilities",
    label: "Behind on utility bills",
    type: "boolean",
  },
  {
    name: "has_high_medical_expenses",
    label: "Has high medical expenses",
    type: "boolean",
  },
  {
    name: "pays_dependent_care",
    label: "Pays for dependent care",
    type: "boolean",
  },
  { name: "filed_taxes", label: "Filed taxes last year", type: "boolean" },
];

export const FACT_BY_NAME: Record<string, FactMeta> = Object.fromEntries(
  FACT_CATALOG.map((f) => [f.name, f]),
);

/** Operators, with the plain-language phrasing shown in the editor. */
export const OPERATORS = [
  { op: "gte", label: "is at least", types: ["number"] },
  { op: "lte", label: "is at most", types: ["number"] },
  { op: "gt", label: "is more than", types: ["number"] },
  { op: "lt", label: "is less than", types: ["number"] },
  { op: "eq", label: "is", types: ["number", "boolean", "string"] },
  { op: "ne", label: "is not", types: ["number", "boolean", "string"] },
  { op: "in", label: "is one of", types: ["string", "number"] },
  { op: "nin", label: "is not one of", types: ["string", "number"] },
] as const;

export type OperatorName = (typeof OPERATORS)[number]["op"];

/** Operators valid for a given fact type (drives the operator dropdown). */
export function operatorsForType(type: FactType) {
  return OPERATORS.filter((o) => (o.types as readonly string[]).includes(type));
}
