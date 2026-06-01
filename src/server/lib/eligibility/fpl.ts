/**
 * Federal Poverty Level helpers.
 *
 * Uses the 2024 HHS poverty guidelines for the 48 contiguous states and DC.
 * Alaska and Hawaii have higher guidelines; because the screener only collects
 * state as free text we can't reliably branch on it, so we use the contiguous
 * figures everywhere. This is a screening estimate, not an official
 * determination — programs apply their own current limits at application time.
 *
 * Source: https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
 */

// Annual poverty line by household size (index 0 = size 1 … index 7 = size 8).
const FPL_2024_BY_SIZE = [
  15_060, 20_440, 25_820, 31_200, 36_580, 41_960, 47_340, 52_720,
];
// Added per person for households larger than 8.
const FPL_2024_INCREMENT = 5_380;

/** Annual federal poverty line for a household of the given size. */
export function federalPovertyLine(householdSize: number): number {
  const n = Math.max(1, Math.floor(householdSize));
  if (n <= FPL_2024_BY_SIZE.length) {
    return FPL_2024_BY_SIZE[n - 1]!;
  }
  const extra = n - FPL_2024_BY_SIZE.length;
  return FPL_2024_BY_SIZE[FPL_2024_BY_SIZE.length - 1]! + extra * FPL_2024_INCREMENT;
}

/** Annual income as a percentage of the federal poverty line (e.g. 130). */
export function fplPercent(annualIncome: number, householdSize: number): number {
  const line = federalPovertyLine(householdSize);
  if (line <= 0) return 0;
  return (annualIncome / line) * 100;
}
