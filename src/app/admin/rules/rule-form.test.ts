import { describe, expect, it } from "vitest";

import { parseRules, serializeRules } from "./rule-form";

describe("rule-form serialize/parse", () => {
  it("round-trips a nested rule (any-of-all) back to the same JSON", () => {
    const rules = {
      summary: "Test basis",
      requirements: [
        {
          key: "income",
          condition: { fact: "income_pct_fpl", op: "lte", value: 130 },
          label_en: "Income within limit",
          label_es: "Ingresos dentro del límite",
        },
        {
          key: "status",
          hard: true,
          condition: {
            any: [
              { fact: "is_citizen_or_qualified", op: "eq", value: true },
              {
                all: [
                  { fact: "age", op: "gte", value: 65 },
                  { fact: "has_disability", op: "eq", value: true },
                ],
              },
            ],
          },
          label_en: "Eligible status",
          label_es: "Estado elegible",
          unmet_en: "Status not eligible",
        },
      ],
      states: { CA: { note: "broader limit", add: [] } },
    };

    const { form, passthrough, ok } = parseRules(rules);
    expect(ok).toBe(true);
    // `states` isn't editable in the guided form — it must survive untouched.
    expect(passthrough).toEqual({ states: rules.states });
    expect(serializeRules(form, passthrough)).toEqual(rules);
  });

  it("coerces values by fact type, including in/nin arrays", () => {
    const { form } = parseRules({
      requirements: [
        {
          key: "cat",
          condition: {
            fact: "citizenship",
            op: "in",
            value: ["us_citizen", "permanent_resident"],
          },
          label_en: "Qualified status",
          label_es: "Estado calificado",
        },
      ],
    });
    // The array is shown as a comma string in the form…
    expect(form.requirements[0]!.condition).toMatchObject({
      t: "leaf",
      value: "us_citizen, permanent_resident",
    });
    // …and serializes back to a string array.
    const out = serializeRules(form) as {
      requirements: { condition: { value: unknown } }[];
    };
    expect(out.requirements[0]!.condition.value).toEqual([
      "us_citizen",
      "permanent_resident",
    ]);
  });

  it("reports ok:false when the shape can't be represented", () => {
    expect(parseRules({ requirements: "nope" }).ok).toBe(false);
    expect(parseRules(null).ok).toBe(false);
  });
});
