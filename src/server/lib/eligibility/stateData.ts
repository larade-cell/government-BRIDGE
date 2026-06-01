/**
 * Per-state eligibility parameters — the single editable source of truth for
 * state-specific rule generation (see programRules.ts).
 *
 * ⚠️ ACCURACY: Medicaid expansion status is reliable and current as of 2024
 * (10 non-expansion states). Everything else is a BEST-EFFORT SCREENING
 * APPROXIMATION, not authoritative policy:
 *   - `snapGrossLimitPct`: SNAP gross-income limit (% FPL). 130 = federal
 *     standard; 165/185/200 = broad-based categorical eligibility. Several
 *     assignments are estimated.
 *   - `tier`: a coarse "generosity" bucket used to approximate CHIP, TANF, and
 *     child-care (CCDF) income limits, which in reality are set per state (and
 *     for TANF, in dollars, not % FPL). These are deliberately rough.
 *
 * Verify against current state policy before relying on any non-Medicaid
 * value, and edit per program in the admin rules console. Encoding it here as
 * one table keeps corrections in a single place.
 */
import { US_STATES } from "./states";

type Tier = "high" | "mid" | "low";

// Derived income limits (% FPL) by generosity tier. Base program limits:
// CHIP 250, CCDF 200, TANF 100 — a value equal to the base emits no override.
const TIER_CHIP: Record<Tier, number> = { high: 320, mid: 250, low: 205 };
const TIER_TANF: Record<Tier, number> = { high: 60, mid: 50, low: 35 };
const TIER_CCDF: Record<Tier, number> = { high: 250, mid: 200, low: 150 };

// [medicaidExpanded, snapGrossLimitPct, tier]
const RAW: Record<string, [boolean, number, Tier]> = {
  AL: [false, 130, "low"],
  AK: [true, 200, "mid"],
  AZ: [true, 200, "mid"],
  AR: [true, 130, "low"],
  CA: [true, 200, "high"],
  CO: [true, 200, "high"],
  CT: [true, 200, "high"],
  DE: [true, 200, "mid"],
  DC: [true, 200, "high"],
  FL: [false, 200, "low"],
  GA: [false, 130, "low"],
  HI: [true, 200, "high"],
  ID: [true, 130, "low"],
  IL: [true, 200, "high"],
  IN: [true, 130, "low"],
  IA: [true, 200, "mid"],
  KS: [false, 130, "low"],
  KY: [true, 200, "mid"],
  LA: [true, 130, "low"],
  ME: [true, 200, "high"],
  MD: [true, 200, "high"],
  MA: [true, 200, "high"],
  MI: [true, 200, "mid"],
  MN: [true, 200, "high"],
  MS: [false, 130, "low"],
  MO: [true, 130, "low"],
  MT: [true, 200, "mid"],
  NE: [true, 165, "mid"],
  NV: [true, 200, "mid"],
  NH: [true, 200, "high"],
  NJ: [true, 185, "high"],
  NM: [true, 200, "high"],
  NY: [true, 200, "high"],
  NC: [true, 200, "mid"],
  ND: [true, 200, "low"],
  OH: [true, 200, "mid"],
  OK: [true, 130, "low"],
  OR: [true, 200, "high"],
  PA: [true, 200, "mid"],
  RI: [true, 200, "high"],
  SC: [false, 130, "low"],
  SD: [true, 130, "low"],
  TN: [false, 130, "low"],
  TX: [false, 165, "low"],
  UT: [true, 130, "low"],
  VT: [true, 200, "high"],
  VA: [true, 200, "mid"],
  WA: [true, 200, "high"],
  WV: [true, 200, "low"],
  WI: [false, 200, "mid"],
  WY: [false, 130, "low"],
};

export interface StateProfile {
  code: string;
  name: string;
  medicaidExpanded: boolean;
  /** SNAP gross-income limit, % FPL (130 = federal standard). */
  snapGrossLimitPct: number;
  /** CHIP upper income limit for children, % FPL (approximate). */
  chipUpperPct: number;
  /** TANF income limit, % FPL (approximate; real limits are dollar-based). */
  tanfLimitPct: number;
  /** Child-care (CCDF) entry income limit, % FPL (approximate). */
  ccdfLimitPct: number;
}

export const STATE_PROFILES: Record<string, StateProfile> = Object.fromEntries(
  Object.entries(RAW).map(([code, [medicaidExpanded, snapGrossLimitPct, tier]]) => [
    code,
    {
      code,
      name: US_STATES[code] ?? code,
      medicaidExpanded,
      snapGrossLimitPct,
      chipUpperPct: TIER_CHIP[tier],
      tanfLimitPct: TIER_TANF[tier],
      ccdfLimitPct: TIER_CCDF[tier],
    },
  ]),
);
