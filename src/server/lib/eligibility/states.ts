/**
 * US state/territory reference and free-text normalization.
 *
 * The screener captures residence as free text ("CA", "California", "calif."),
 * so state-specific rules need a stable key. `normalizeState` maps common forms
 * to a 2-letter code (uppercase), returning undefined when it can't tell — in
 * which case the engine falls back to the program's base (federal) rules.
 */

export const US_STATES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export const STATE_CODES = Object.keys(US_STATES);

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

// A few common aliases beyond the canonical name.
const ALIASES: Record<string, string> = {
  "washington dc": "DC",
  "washington d.c.": "DC",
  "d.c.": "DC",
  "calif": "CA",
  "mass": "MA",
  "penn": "PA",
};

/** Normalize free-text state input to a 2-letter code, or undefined. */
export function normalizeState(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const raw = input.trim();
  if (raw === "") return undefined;

  const upper = raw.toUpperCase();
  if (upper.length === 2 && US_STATES[upper]) return upper;

  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  return NAME_TO_CODE[lower] ?? ALIASES[lower] ?? undefined;
}
