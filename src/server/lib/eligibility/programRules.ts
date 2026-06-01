/**
 * Eligibility rules per program, keyed by `program_key`.
 *
 * These are SCREENING HEURISTICS based on common federal thresholds (mostly a
 * percentage of the federal poverty level plus categorical requirements). They
 * are intentionally simplified — real programs apply state-specific limits,
 * deductions, and resource tests at application time. The screener leans
 * generous (`false_positive_bias`) so a borderline income never hard-rejects a
 * resident; categorical facts (having a child, being a veteran, etc.) are
 * marked `hard` because failing them means the program genuinely doesn't apply.
 *
 * `prisma/seed.ts` writes each entry verbatim into
 * `eligibility_rule_versions.rules_json`; the runtime reads it back from there.
 *
 * Income thresholds reference the `income_pct_fpl` fact (annual household
 * income as a percent of the federal poverty line for the household size).
 */
import type { ProgramRules } from "./types";

export const PROGRAM_RULES: Record<string, ProgramRules> = {
  snap: {
    summary: "Gross monthly income ≤ ~130% FPL; qualified immigration status.",
    requirements: [
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 130 },
        label_en: "Household income at or below about 130% of the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al ~130% del nivel federal de pobreza",
        unmet_en: "Your household income may be above SNAP's gross income limit (about 130% of the federal poverty level).",
        unmet_es: "El ingreso de su hogar podría superar el límite de ingresos brutos de SNAP (~130% del nivel federal de pobreza).",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or qualified immigration status",
        label_es: "Ciudadano/a estadounidense o estado migratorio calificado",
      },
    ],
  },

  medicaid: {
    summary: "Income ≤ 138% FPL for adults; higher limits for pregnant people and children.",
    requirements: [
      {
        key: "income",
        condition: {
          any: [
            { fact: "income_pct_fpl", op: "lte", value: 138 },
            { all: [{ fact: "is_pregnant", op: "eq", value: true }, { fact: "income_pct_fpl", op: "lte", value: 205 }] },
            { all: [{ fact: "has_children", op: "eq", value: true }, { fact: "income_pct_fpl", op: "lte", value: 205 }] },
          ],
        },
        label_en: "Household income within your state's Medicaid limits",
        label_es: "Ingreso del hogar dentro de los límites de Medicaid de su estado",
        unmet_en: "Your household income may be above Medicaid's limit. If you're pregnant or have children, the limit is higher — it's still worth applying.",
        unmet_es: "El ingreso de su hogar podría superar el límite de Medicaid. Si está embarazada o tiene hijos, el límite es más alto — vale la pena solicitar.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or qualified immigration status",
        label_es: "Ciudadano/a estadounidense o estado migratorio calificado",
      },
    ],
  },

  tanf: {
    summary: "Families with children, very low income, qualified status.",
    requirements: [
      {
        key: "children",
        hard: true,
        condition: { fact: "has_children", op: "eq", value: true },
        label_en: "At least one child under 18 in the household",
        label_es: "Al menos un niño menor de 18 años en el hogar",
        unmet_en: "TANF cash assistance is for families with children under 18.",
        unmet_es: "La asistencia en efectivo de TANF es para familias con hijos menores de 18 años.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 100 },
        label_en: "Household income at or below the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al nivel federal de pobreza",
        unmet_en: "Your income may be above your state's TANF limit, though limits vary widely by state.",
        unmet_es: "Su ingreso podría superar el límite de TANF de su estado, aunque los límites varían mucho por estado.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or qualified immigration status",
        label_es: "Ciudadano/a estadounidense o estado migratorio calificado",
      },
    ],
  },

  wic: {
    summary: "Pregnant person or child under 5 in household; income ≤ 185% FPL.",
    requirements: [
      {
        key: "category",
        hard: true,
        condition: {
          any: [
            { fact: "is_pregnant", op: "eq", value: true },
            { fact: "num_children", op: "gte", value: 1 },
          ],
        },
        label_en: "Pregnant, or has a young child in the household",
        label_es: "Embarazada, o con un niño pequeño en el hogar",
        unmet_en: "WIC serves pregnant and postpartum people, infants, and children under 5.",
        unmet_es: "WIC atiende a personas embarazadas y posparto, bebés y niños menores de 5 años.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 185 },
        label_en: "Household income at or below 185% of the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al 185% del nivel federal de pobreza",
        unmet_en: "Your household income may be above WIC's limit (185% of the federal poverty level).",
        unmet_es: "El ingreso de su hogar podría superar el límite de WIC (185% del nivel federal de pobreza).",
      },
    ],
  },

  ssi: {
    summary: "Age 65+, blind, or disabled; very low income and limited resources.",
    requirements: [
      {
        key: "category",
        hard: true,
        condition: {
          any: [
            { fact: "age", op: "gte", value: 65 },
            { fact: "has_disability", op: "eq", value: true },
          ],
        },
        label_en: "Age 65 or older, or has a disability or is blind",
        label_es: "65 años o más, o tiene una discapacidad o es ciego",
        unmet_en: "SSI is for people who are 65+, blind, or have a qualifying disability.",
        unmet_es: "SSI es para personas de 65 años o más, ciegas o con una discapacidad calificada.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 100 },
        label_en: "Very limited income",
        label_es: "Ingreso muy limitado",
        unmet_en: "Your income may be above SSI's limit.",
        unmet_es: "Su ingreso podría superar el límite de SSI.",
      },
      {
        key: "resources",
        condition: { fact: "assets", op: "lte", value: 3000 },
        label_en: "Countable resources at or below the SSI limit (about $2,000 single / $3,000 couple)",
        label_es: "Recursos contables iguales o menores al límite de SSI (~$2,000 individual / $3,000 pareja)",
        unmet_en: "Your savings and resources may be above SSI's limit (about $2,000 for an individual).",
        unmet_es: "Sus ahorros y recursos podrían superar el límite de SSI (~$2,000 para un individuo).",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or qualified immigration status",
        label_es: "Ciudadano/a estadounidense o estado migratorio calificado",
      },
    ],
  },

  chip: {
    summary: "Children in households above Medicaid limits but with moderate income.",
    requirements: [
      {
        key: "children",
        hard: true,
        condition: { fact: "has_children", op: "eq", value: true },
        label_en: "At least one child under 19 in the household",
        label_es: "Al menos un niño menor de 19 años en el hogar",
        unmet_en: "CHIP covers children. There must be a child in the household to qualify.",
        unmet_es: "CHIP cubre a los niños. Debe haber un niño en el hogar para calificar.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 250 },
        label_en: "Household income within your state's CHIP range",
        label_es: "Ingreso del hogar dentro del rango de CHIP de su estado",
        unmet_en: "Your household income may be above your state's CHIP limit.",
        unmet_es: "El ingreso de su hogar podría superar el límite de CHIP de su estado.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "Child is a U.S. citizen or qualified immigrant",
        label_es: "El niño es ciudadano estadounidense o inmigrante calificado",
      },
    ],
  },

  liheap: {
    summary: "Low-income households; ≤ 150% FPL is a common cutoff.",
    requirements: [
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 150 },
        label_en: "Household income at or below 150% of the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al 150% del nivel federal de pobreza",
        unmet_en: "Your household income may be above your state's LIHEAP limit (often around 150% of the federal poverty level).",
        unmet_es: "El ingreso de su hogar podría superar el límite de LIHEAP de su estado (a menudo alrededor del 150% del nivel federal de pobreza).",
      },
    ],
  },

  housing_choice_voucher: {
    summary: "Low income relative to area median; qualified status. Long waitlists.",
    requirements: [
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 200 },
        label_en: "Low income for your area",
        label_es: "Bajos ingresos para su área",
        unmet_en: "Vouchers use Area Median Income, which varies by location — your income may still qualify in a higher-cost area. Waitlists are often long.",
        unmet_es: "Los vales usan el ingreso medio del área, que varía por ubicación — su ingreso podría calificar en un área de mayor costo. Las listas de espera suelen ser largas.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or eligible immigration status",
        label_es: "Ciudadano/a estadounidense o estado migratorio elegible",
      },
    ],
  },

  eitc: {
    summary: "Workers with earned income below the annual limit.",
    requirements: [
      {
        key: "earned_income",
        hard: true,
        condition: { fact: "earned_income", op: "gt", value: 0 },
        label_en: "Has income from working (wages or self-employment)",
        label_es: "Tiene ingresos del trabajo (salarios o trabajo por cuenta propia)",
        unmet_en: "The EITC requires earned income from a job or self-employment.",
        unmet_es: "El EITC requiere ingresos del trabajo de un empleo o trabajo por cuenta propia.",
      },
      {
        key: "income",
        condition: { fact: "annual_income", op: "lte", value: 63398 },
        label_en: "Earned income below the EITC limit (up to about $63,000, depending on children)",
        label_es: "Ingreso del trabajo por debajo del límite del EITC (hasta ~$63,000, según los hijos)",
        unmet_en: "Your income may be above the EITC limit, which depends on the number of children.",
        unmet_es: "Su ingreso podría superar el límite del EITC, que depende del número de hijos.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "Has a valid Social Security number / qualified status",
        label_es: "Tiene un número de Seguro Social válido / estado calificado",
      },
    ],
  },

  ctc: {
    summary: "Families with a qualifying child under 17; very high income phase-out.",
    requirements: [
      {
        key: "children",
        hard: true,
        condition: { fact: "has_children", op: "eq", value: true },
        label_en: "Has a qualifying child under 17",
        label_es: "Tiene un hijo calificado menor de 17 años",
        unmet_en: "The Child Tax Credit is for families with a qualifying child under 17.",
        unmet_es: "El Crédito Tributario por Hijos es para familias con un hijo calificado menor de 17 años.",
      },
      {
        key: "income",
        condition: { fact: "annual_income", op: "lte", value: 400000 },
        label_en: "Income below the phase-out ($200k single / $400k married)",
        label_es: "Ingreso por debajo de la eliminación gradual ($200k individual / $400k casados)",
      },
    ],
  },

  lifeline: {
    summary: "Income ≤ 135% FPL or participation in another benefit.",
    requirements: [
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 135 },
        label_en: "Household income at or below 135% of the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al 135% del nivel federal de pobreza",
        unmet_en: "Your income may be above Lifeline's limit, but you can also qualify by receiving SNAP, Medicaid, or SSI.",
        unmet_es: "Su ingreso podría superar el límite de Lifeline, pero también puede calificar si recibe SNAP, Medicaid o SSI.",
      },
    ],
  },

  school_meals: {
    summary: "School-age children; income ≤ 185% FPL (reduced price) / 130% (free).",
    requirements: [
      {
        key: "children",
        hard: true,
        condition: { fact: "has_children", op: "eq", value: true },
        label_en: "Has school-age children in the household",
        label_es: "Tiene niños en edad escolar en el hogar",
        unmet_en: "Free and reduced-price school meals are for households with children in school.",
        unmet_es: "Las comidas escolares gratuitas y a precio reducido son para hogares con niños en la escuela.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 185 },
        label_en: "Household income at or below 185% of the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al 185% del nivel federal de pobreza",
        unmet_en: "Your income may be above the limit for reduced-price meals (185% of the federal poverty level).",
        unmet_es: "Su ingreso podría superar el límite para comidas a precio reducido (185% del nivel federal de pobreza).",
      },
    ],
  },

  unemployment_insurance: {
    summary: "Recently and involuntarily unemployed; able and available to work.",
    requirements: [
      {
        key: "unemployed",
        hard: true,
        condition: { fact: "employment_status", op: "eq", value: "unemployed" },
        label_en: "Currently unemployed and looking for work",
        label_es: "Actualmente desempleado/a y buscando trabajo",
        unmet_en: "Unemployment Insurance is for people who recently lost a job and are able and available to work.",
        unmet_es: "El Seguro de Desempleo es para personas que perdieron su empleo recientemente y pueden y están disponibles para trabajar.",
      },
    ],
  },

  aca_marketplace: {
    summary: "Income at/above 100% FPL (below → Medicaid); qualified status.",
    requirements: [
      {
        key: "income_floor",
        condition: { fact: "income_pct_fpl", op: "gte", value: 100 },
        label_en: "Household income at or above the federal poverty level",
        label_es: "Ingreso del hogar igual o mayor al nivel federal de pobreza",
        unmet_en: "Your income may be low enough for Medicaid instead, which usually costs less than a Marketplace plan.",
        unmet_es: "Su ingreso podría ser lo suficientemente bajo para Medicaid, que generalmente cuesta menos que un plan del Mercado.",
      },
      {
        key: "status",
        hard: true,
        condition: { fact: "is_citizen_or_qualified", op: "eq", value: true },
        label_en: "U.S. citizen or lawfully present",
        label_es: "Ciudadano/a estadounidense o presente legalmente",
      },
    ],
  },

  head_start: {
    summary: "Pregnant person or child under 5; income ≤ 100% FPL.",
    requirements: [
      {
        key: "category",
        hard: true,
        condition: {
          any: [
            { fact: "is_pregnant", op: "eq", value: true },
            { fact: "num_children", op: "gte", value: 1 },
          ],
        },
        label_en: "Pregnant, or has a child under 5 in the household",
        label_es: "Embarazada, o con un niño menor de 5 años en el hogar",
        unmet_en: "Head Start serves pregnant people and children from birth to age 5.",
        unmet_es: "Head Start atiende a personas embarazadas y niños desde el nacimiento hasta los 5 años.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 100 },
        label_en: "Household income at or below the federal poverty level",
        label_es: "Ingreso del hogar igual o menor al nivel federal de pobreza",
        unmet_en: "Your income may be above the Head Start limit, though some slots go to families above it.",
        unmet_es: "Su ingreso podría superar el límite de Head Start, aunque algunos cupos son para familias por encima de él.",
      },
    ],
  },

  pell_grant: {
    summary: "Undergraduate students with financial need.",
    requirements: [
      {
        key: "student",
        hard: true,
        condition: { fact: "is_student", op: "eq", value: true },
        label_en: "Enrolled (or planning to enroll) as an undergraduate student",
        label_es: "Inscrito/a (o planea inscribirse) como estudiante universitario/a",
        unmet_en: "The Pell Grant is for undergraduate college or career-school students.",
        unmet_es: "La Beca Pell es para estudiantes universitarios de pregrado o de escuelas de carrera.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 300 },
        label_en: "Demonstrated financial need",
        label_es: "Necesidad económica demostrada",
        unmet_en: "Higher incomes receive smaller Pell awards, but it's still worth completing the FAFSA.",
        unmet_es: "Los ingresos más altos reciben becas Pell más pequeñas, pero aún vale la pena completar la FAFSA.",
      },
    ],
  },

  ccdf: {
    summary: "Working/in-school families with children needing care; income ≤ ~200% FPL.",
    requirements: [
      {
        key: "children",
        hard: true,
        condition: { fact: "has_children", op: "eq", value: true },
        label_en: "Has a child who needs care",
        label_es: "Tiene un hijo que necesita cuidado",
        unmet_en: "Child care assistance is for families with children who need care.",
        unmet_es: "La asistencia para el cuidado infantil es para familias con hijos que necesitan cuidado.",
      },
      {
        key: "activity",
        hard: true,
        condition: {
          any: [
            { fact: "employment_status", op: "in", value: ["employed_full_time", "employed_part_time", "self_employed"] },
            { fact: "is_student", op: "eq", value: true },
          ],
        },
        label_en: "Working, in school, or in training",
        label_es: "Trabajando, en la escuela o en capacitación",
        unmet_en: "Child care assistance generally requires a parent to be working, in school, or in training.",
        unmet_es: "La asistencia para el cuidado infantil generalmente requiere que un padre esté trabajando, en la escuela o en capacitación.",
      },
      {
        key: "income",
        condition: { fact: "income_pct_fpl", op: "lte", value: 200 },
        label_en: "Household income within your state's child care assistance limit",
        label_es: "Ingreso del hogar dentro del límite de asistencia para el cuidado infantil de su estado",
        unmet_en: "Your income may be above your state's child care assistance limit.",
        unmet_es: "Su ingreso podría superar el límite de asistencia para el cuidado infantil de su estado.",
      },
    ],
  },

  va_health: {
    summary: "Veterans and current service members.",
    requirements: [
      {
        key: "veteran",
        hard: true,
        condition: { fact: "is_veteran", op: "eq", value: true },
        label_en: "Veteran or current military service member",
        label_es: "Veterano/a o miembro actual del servicio militar",
        unmet_en: "VA health care is for veterans and service members. Eligibility also depends on service history.",
        unmet_es: "La atención médica del VA es para veteranos y miembros del servicio. La elegibilidad también depende del historial de servicio.",
      },
    ],
  },
};
