import { describe, expect, it } from "vitest";

import {
  buildFacts,
  effectiveRequirements,
  evalCondition,
  evaluateProgram,
  federalPovertyLine,
  fplPercent,
  normalizeState,
  parseProgramRules,
  PROGRAM_RULES,
  STATE_PROFILES,
  type Facts,
} from "./index";

describe("federalPovertyLine", () => {
  it("returns the 2024 contiguous guideline by household size", () => {
    expect(federalPovertyLine(1)).toBe(15_060);
    expect(federalPovertyLine(4)).toBe(31_200);
    expect(federalPovertyLine(8)).toBe(52_720);
  });

  it("extrapolates beyond size 8 with the per-person increment", () => {
    expect(federalPovertyLine(9)).toBe(52_720 + 5_380);
    expect(federalPovertyLine(10)).toBe(52_720 + 2 * 5_380);
  });

  it("clamps non-positive / fractional sizes to at least one person", () => {
    expect(federalPovertyLine(0)).toBe(15_060);
    expect(federalPovertyLine(1.9)).toBe(15_060);
  });

  it("computes income as a percent of the line", () => {
    expect(fplPercent(15_060, 1)).toBeCloseTo(100);
    expect(fplPercent(31_200 * 1.3, 4)).toBeCloseTo(130);
  });
});

describe("buildFacts", () => {
  it("derives income, FPL %, and categorical facts from answers", () => {
    const facts = buildFacts({
      household_size: 4,
      monthly_household_income: 2600, // 31,200 / yr = 100% FPL for size 4
      monthly_earned_income: 2600,
      num_children_under_18: 2,
      applicant_age: 34,
      citizenship_status: "us_citizen",
      is_pregnant: false,
    });
    expect(facts.annual_income).toBe(31_200);
    expect(facts.income_pct_fpl).toBeCloseTo(100);
    expect(facts.has_children).toBe(true);
    expect(facts.is_citizen_or_qualified).toBe(true);
    expect(facts.is_senior).toBe(false);
  });

  it("leaves unparseable / missing answers undefined (treated as unknown)", () => {
    const facts = buildFacts({ household_size: "", citizenship_status: "" });
    expect(facts.household_size).toBeUndefined();
    expect(facts.income_pct_fpl).toBeUndefined();
    expect(facts.is_citizen_or_qualified).toBeUndefined();
  });

  it("marks non-qualified immigration status as not qualified", () => {
    const facts = buildFacts({ citizenship_status: "none_of_these" });
    expect(facts.is_citizen_or_qualified).toBe(false);
  });
});

describe("evalCondition (three-valued logic)", () => {
  const facts: Facts = { income_pct_fpl: 120, is_pregnant: true, age: undefined };

  it("evaluates leaves", () => {
    expect(evalCondition({ fact: "income_pct_fpl", op: "lte", value: 130 }, facts)).toBe("met");
    expect(evalCondition({ fact: "income_pct_fpl", op: "lte", value: 100 }, facts)).toBe("unmet");
    expect(evalCondition({ fact: "age", op: "gte", value: 65 }, facts)).toBe("unknown");
  });

  it("treats a missing fact as unknown, not failure", () => {
    expect(evalCondition({ fact: "missing_fact", op: "eq", value: true }, facts)).toBe("unknown");
  });

  it("short-circuits all/any and propagates unknown", () => {
    expect(
      evalCondition({ all: [{ fact: "income_pct_fpl", op: "lte", value: 130 }, { fact: "is_pregnant", op: "eq", value: true }] }, facts),
    ).toBe("met");
    // any: a met child wins even when a sibling is unknown.
    expect(
      evalCondition({ any: [{ fact: "age", op: "gte", value: 65 }, { fact: "is_pregnant", op: "eq", value: true }] }, facts),
    ).toBe("met");
    // any: no met child, one unknown → unknown.
    expect(
      evalCondition({ any: [{ fact: "age", op: "gte", value: 65 }, { fact: "income_pct_fpl", op: "lte", value: 50 }] }, facts),
    ).toBe("unknown");
  });

  it("handles in / nin and not", () => {
    const f: Facts = { employment_status: "unemployed" };
    expect(evalCondition({ fact: "employment_status", op: "in", value: ["unemployed", "retired"] }, f)).toBe("met");
    expect(evalCondition({ not: { fact: "employment_status", op: "eq", value: "retired" } }, f)).toBe("met");
  });
});

const snapRules = PROGRAM_RULES.snap!;

describe("evaluateProgram", () => {
  it("returns likely_eligible when every requirement is met", () => {
    const facts = buildFacts({
      household_size: 3,
      monthly_household_income: 1000, // well under 130% FPL
      citizenship_status: "us_citizen",
    });
    const res = evaluateProgram(snapRules, facts, true);
    expect(res.outcome).toBe("likely_eligible");
    expect(res.criteria.every((c) => c.status === "met")).toBe(true);
  });

  it("returns may_be_eligible when only a soft (income) requirement fails under bias", () => {
    const facts = buildFacts({
      household_size: 1,
      monthly_household_income: 9000, // far over 130% FPL
      citizenship_status: "us_citizen",
    });
    expect(evaluateProgram(snapRules, facts, true).outcome).toBe("may_be_eligible");
  });

  it("returns unlikely_eligible for the same soft failure when bias is off", () => {
    const facts = buildFacts({
      household_size: 1,
      monthly_household_income: 9000,
      citizenship_status: "us_citizen",
    });
    expect(evaluateProgram(snapRules, facts, false).outcome).toBe("unlikely_eligible");
  });

  it("returns unlikely_eligible when a hard requirement fails, even under bias", () => {
    const facts = buildFacts({
      household_size: 3,
      monthly_household_income: 1000,
      citizenship_status: "none_of_these", // hard status requirement fails
    });
    expect(evaluateProgram(snapRules, facts, true).outcome).toBe("unlikely_eligible");
  });

  it("returns may_be_eligible (bias) / needs_more_info (no bias) when answers are missing", () => {
    const facts = buildFacts({}); // nothing answered
    expect(evaluateProgram(snapRules, facts, true).outcome).toBe("may_be_eligible");
    expect(evaluateProgram(snapRules, facts, false).outcome).toBe("needs_more_info");
  });

  it("honors a categorical (hard) requirement: WIC needs pregnancy or a child", () => {
    const wic = PROGRAM_RULES.wic!;
    const noKids = buildFacts({ household_size: 1, monthly_household_income: 500, is_pregnant: false, num_children_under_18: 0 });
    expect(evaluateProgram(wic, noKids, true).outcome).toBe("unlikely_eligible");

    const pregnant = buildFacts({ household_size: 2, monthly_household_income: 500, is_pregnant: true, num_children_under_18: 0 });
    expect(evaluateProgram(wic, pregnant, true).outcome).toBe("likely_eligible");
  });

  it("evaluates VA health on veteran status alone", () => {
    const va = PROGRAM_RULES.va_health!;
    expect(evaluateProgram(va, buildFacts({ is_veteran: true }), true).outcome).toBe("likely_eligible");
    expect(evaluateProgram(va, buildFacts({ is_veteran: false }), true).outcome).toBe("unlikely_eligible");
  });

  it("emits an English reason per requirement", () => {
    const facts = buildFacts({ household_size: 3, monthly_household_income: 1000, citizenship_status: "us_citizen" });
    const res = evaluateProgram(snapRules, facts, true);
    expect(res.reasons).toHaveLength(snapRules.requirements.length);
    expect(res.reasons.every((r) => typeof r === "string" && r.length > 0)).toBe(true);
  });
});

describe("normalizeState", () => {
  it("accepts 2-letter codes (any case)", () => {
    expect(normalizeState("CA")).toBe("CA");
    expect(normalizeState("ca")).toBe("CA");
    expect(normalizeState("  ny ")).toBe("NY");
  });
  it("accepts full names and aliases", () => {
    expect(normalizeState("California")).toBe("CA");
    expect(normalizeState("texas")).toBe("TX");
    expect(normalizeState("district of columbia")).toBe("DC");
    expect(normalizeState("Washington DC")).toBe("DC");
  });
  it("returns undefined for unrecognized / empty input", () => {
    expect(normalizeState("Narnia")).toBeUndefined();
    expect(normalizeState("")).toBeUndefined();
    expect(normalizeState(undefined)).toBeUndefined();
  });
});

describe("state-specific rules", () => {
  it("covers all 50 states + DC, with the correct Medicaid non-expansion set", () => {
    expect(Object.keys(STATE_PROFILES)).toHaveLength(51);
    const nonExpansion = Object.values(STATE_PROFILES)
      .filter((p) => !p.medicaidExpanded)
      .map((p) => p.code)
      .sort();
    expect(nonExpansion).toEqual([
      "AL", "FL", "GA", "KS", "MS", "SC", "TN", "TX", "WI", "WY",
    ]);
    // SNAP and Medicaid both carry state variations spanning many states.
    expect(Object.keys(PROGRAM_RULES.snap!.states ?? {}).length).toBeGreaterThan(20);
    expect(Object.keys(PROGRAM_RULES.medicaid!.states ?? {})).toHaveLength(10);
    // TANF varies in every state (limit ≠ 100% base everywhere).
    expect(Object.keys(PROGRAM_RULES.tanf!.states ?? {})).toHaveLength(51);
  });

  it("effectiveRequirements overrides a base criterion by key for the state", () => {
    const base = PROGRAM_RULES.snap!;
    const fed = effectiveRequirements(base, undefined);
    const ca = effectiveRequirements(base, "CA");
    expect(fed.appliedState).toBeUndefined();
    expect(ca.appliedState).toBe("CA");
    // Same number of requirements — the income criterion is replaced, not added.
    expect(ca.requirements).toHaveLength(fed.requirements.length);
    const fedIncome = fed.requirements.find((r) => r.key === "income");
    const caIncome = ca.requirements.find((r) => r.key === "income");
    expect((fedIncome!.condition as { value: number }).value).toBe(130);
    expect((caIncome!.condition as { value: number }).value).toBe(200);
  });

  it("SNAP: a BBCE state raises the income limit (160% FPL passes in CA, not in TX)", () => {
    const snap = PROGRAM_RULES.snap!;
    // ~160% FPL for a household of 1.
    const answers = {
      household_size: 1,
      monthly_household_income: Math.round((15_060 * 1.6) / 12),
      citizenship_status: "us_citizen",
    };
    const ca = evaluateProgram(snap, buildFacts({ ...answers, state_residence: "California" }), true);
    expect(ca.outcome).toBe("likely_eligible");
    expect(ca.applied_state).toBe("CA");
    expect(ca.reasons[0]).toContain("Adjusted for your state (CA)");

    // Georgia uses the 130% federal gross limit (no BBCE override).
    const ga = evaluateProgram(snap, buildFacts({ ...answers, state_residence: "Georgia" }), true);
    // 160% is over the 130% base — soft miss, generous bias → may_be.
    expect(ga.outcome).toBe("may_be_eligible");
    expect(ga.applied_state).toBeNull();
  });

  it("Medicaid: non-expansion state excludes a childless adult (hard), expansion state covers them", () => {
    const medicaid = PROGRAM_RULES.medicaid!;
    const childlessAdult = {
      household_size: 1,
      monthly_household_income: Math.round((15_060 * 1.2) / 12), // 120% FPL
      num_children_under_18: 0,
      is_pregnant: false,
      has_disability: false,
      citizenship_status: "us_citizen",
    };
    // Expansion state (not in the non-expansion list) → base 138% pathway.
    const ca = evaluateProgram(medicaid, buildFacts({ ...childlessAdult, state_residence: "CA" }), true);
    expect(ca.outcome).toBe("likely_eligible");
    // Non-expansion state → hard exclusion, not rescued by bias.
    const tx = evaluateProgram(medicaid, buildFacts({ ...childlessAdult, state_residence: "TX" }), true);
    expect(tx.outcome).toBe("unlikely_eligible");
    expect(tx.applied_state).toBe("TX");

    // A pregnant resident in the same non-expansion state still qualifies.
    const pregnantTx = evaluateProgram(
      medicaid,
      buildFacts({ ...childlessAdult, is_pregnant: true, state_residence: "TX" }),
      true,
    );
    expect(pregnantTx.outcome).toBe("likely_eligible");
  });
});

describe("parseProgramRules", () => {
  it("accepts every seeded program rule set", () => {
    for (const [key, rules] of Object.entries(PROGRAM_RULES)) {
      const roundTripped: unknown = JSON.parse(JSON.stringify(rules));
      const parsed = parseProgramRules(roundTripped);
      expect(parsed, `program ${key}`).not.toBeNull();
      expect(parsed!.requirements.length).toBeGreaterThan(0);
    }
  });

  it("rejects the legacy placeholder shape", () => {
    expect(
      parseProgramRules({ outcome: "may_be_eligible", reasons: ["x"] }),
    ).toBeNull();
  });

  it("rejects non-objects and empty requirement lists", () => {
    expect(parseProgramRules(null)).toBeNull();
    expect(parseProgramRules("nope")).toBeNull();
    expect(parseProgramRules({ requirements: [] })).toBeNull();
  });
});
