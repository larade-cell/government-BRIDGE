import { buildFacts, type Facts } from "./eligibility";

export type CasePriority = "low" | "normal" | "high" | "urgent";

/**
 * Auto-triage a help request from the resident's screening answers. Returns the
 * suggested priority plus a short human-readable reason (shown to caseworkers).
 * Caseworkers can always override it manually.
 *
 * Heuristic, in order of severity:
 *   - urgent: immediate stability risk (homeless/shelter, no income, utility
 *     shut-off risk)
 *   - high:   vulnerable household with low income (pregnant/disabled, or
 *     children below the poverty level)
 *   - normal: everyone else
 */
export function computeCasePriority(facts: Facts): {
  priority: CasePriority;
  reason: string | null;
} {
  const housing = facts.housing_status;
  const income = facts.monthly_income;
  const fpl = facts.income_pct_fpl;

  if (housing === "homeless" || housing === "shelter_or_transitional") {
    return { priority: "urgent", reason: "Homeless or in shelter / transitional housing" };
  }
  if (facts.behind_on_utilities === true) {
    return { priority: "urgent", reason: "Behind on utilities — at risk of shut-off" };
  }
  if (typeof income === "number" && income === 0) {
    return { priority: "urgent", reason: "Reported no household income" };
  }

  if (
    (facts.is_pregnant === true || facts.has_disability === true) &&
    typeof fpl === "number" &&
    fpl <= 138
  ) {
    return { priority: "high", reason: "Pregnant or has a disability, with low income" };
  }
  if (facts.has_children === true && typeof fpl === "number" && fpl <= 100) {
    return { priority: "high", reason: "Household with children below the poverty level" };
  }

  return { priority: "normal", reason: null };
}

/** Derive priority directly from a session's answers (keyed by question_key). */
export function priorityFromAnswers(answers: Record<string, unknown>) {
  return computeCasePriority(buildFacts(answers));
}
