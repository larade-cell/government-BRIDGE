/**
 * Reference-data seed for BRIDGE.
 *
 * Idempotent: every entity is upserted by a natural key (`code`, `program_key`,
 * `doc_key`, `question_key`, etc.) so running this multiple times is safe.
 */
import { PrismaClient } from "../generated/prisma/client";

const db = new PrismaClient();

async function main() {
  // ---- Languages ----------------------------------------------------------
  await db.languages.upsert({
    where: { code: "en" },
    update: { name: "English" },
    create: { code: "en", name: "English" },
  });
  await db.languages.upsert({
    where: { code: "es" },
    update: { name: "Spanish" },
    create: { code: "es", name: "Spanish" },
  });

  // ---- Programs -----------------------------------------------------------
  const snap = await db.programs.upsert({
    where: { program_key: "snap" },
    update: {},
    create: {
      program_key: "snap",
      category: "food",
      authoritative_url: "https://www.fns.usda.gov/snap/",
    },
  });

  const medicaid = await db.programs.upsert({
    where: { program_key: "medicaid" },
    update: {},
    create: {
      program_key: "medicaid",
      category: "healthcare",
      authoritative_url: "https://www.medicaid.gov/",
    },
  });

  // Translations (composite PK on program_id + language_code)
  await db.program_translations.upsert({
    where: {
      program_id_language_code: { program_id: snap.id, language_code: "en" },
    },
    update: {
      name: "SNAP (Food Stamps)",
      short_description:
        "Federal food assistance for low-income households to help buy groceries.",
      next_steps:
        "Apply through your state's SNAP office. Bring proof of income, ID, and residency.",
    },
    create: {
      program_id: snap.id,
      language_code: "en",
      name: "SNAP (Food Stamps)",
      short_description:
        "Federal food assistance for low-income households to help buy groceries.",
      next_steps:
        "Apply through your state's SNAP office. Bring proof of income, ID, and residency.",
    },
  });
  await db.program_translations.upsert({
    where: {
      program_id_language_code: { program_id: snap.id, language_code: "es" },
    },
    update: {
      name: "SNAP (Cupones de Alimentos)",
      short_description:
        "Asistencia alimentaria federal para hogares de bajos ingresos para ayudar a comprar comestibles.",
      next_steps:
        "Solicite a través de la oficina estatal de SNAP. Traiga prueba de ingresos, identificación y residencia.",
    },
    create: {
      program_id: snap.id,
      language_code: "es",
      name: "SNAP (Cupones de Alimentos)",
      short_description:
        "Asistencia alimentaria federal para hogares de bajos ingresos para ayudar a comprar comestibles.",
      next_steps:
        "Solicite a través de la oficina estatal de SNAP. Traiga prueba de ingresos, identificación y residencia.",
    },
  });
  await db.program_translations.upsert({
    where: {
      program_id_language_code: {
        program_id: medicaid.id,
        language_code: "en",
      },
    },
    update: {
      name: "Medicaid",
      short_description:
        "Free or low-cost health coverage for eligible low-income adults, children, pregnant people, and people with disabilities.",
      next_steps:
        "Apply through your state's Medicaid agency or HealthCare.gov.",
    },
    create: {
      program_id: medicaid.id,
      language_code: "en",
      name: "Medicaid",
      short_description:
        "Free or low-cost health coverage for eligible low-income adults, children, pregnant people, and people with disabilities.",
      next_steps:
        "Apply through your state's Medicaid agency or HealthCare.gov.",
    },
  });

  // Populate search_vector from English translations (raw SQL — Prisma can't
  // express tsvector functions natively).
  await db.$executeRawUnsafe(`
    UPDATE programs p SET search_vector = (
      SELECT to_tsvector('english',
        coalesce(string_agg(pt.name, ' '), '') || ' ' ||
        coalesce(string_agg(pt.short_description, ' '), '')
      )
      FROM program_translations pt WHERE pt.program_id = p.id
    )
  `);

  // ---- Questions ----------------------------------------------------------
  // Minimal set covering the screening core: household size, monthly income,
  // citizenship/eligibility, and a binary "are you pregnant" branch.
  const questionSeeds = [
    {
      question_key: "household_size",
      answer_type: "integer",
      display_order: 1,
      prompts: {
        en: { prompt: "How many people live in your household, including you?" },
        es: { prompt: "¿Cuántas personas viven en su hogar, incluyéndolo a usted?" },
      },
    },
    {
      question_key: "monthly_household_income",
      answer_type: "decimal",
      display_order: 2,
      prompts: {
        en: {
          prompt: "What is your household's total monthly income before taxes?",
          helper_text: "Include wages, benefits, child support — everyone in the household.",
        },
        es: {
          prompt: "¿Cuál es el ingreso mensual total de su hogar antes de impuestos?",
        },
      },
    },
    {
      question_key: "citizenship_status",
      answer_type: "single_select",
      display_order: 3,
      prompts: {
        en: { prompt: "What is your citizenship or immigration status?" },
        es: { prompt: "¿Cuál es su estado de ciudadanía o inmigración?" },
      },
      options: [
        { key: "us_citizen", en: "U.S. citizen", es: "Ciudadano estadounidense" },
        { key: "permanent_resident", en: "Permanent resident", es: "Residente permanente" },
        { key: "other", en: "Other / prefer not to say", es: "Otro / prefiero no decir" },
      ],
    },
    {
      question_key: "is_pregnant",
      answer_type: "boolean",
      display_order: 4,
      prompts: {
        en: { prompt: "Are you or anyone in your household currently pregnant?" },
        es: { prompt: "¿Está usted o alguien en su hogar embarazada actualmente?" },
      },
    },
  ];

  for (const q of questionSeeds) {
    const question = await db.questions.upsert({
      where: { question_key: q.question_key },
      update: {
        answer_type: q.answer_type,
        display_order: q.display_order,
      },
      create: {
        question_key: q.question_key,
        answer_type: q.answer_type,
        display_order: q.display_order,
      },
    });

    for (const [lang, t] of Object.entries(q.prompts)) {
      await db.question_translations.upsert({
        where: {
          question_id_language_code: {
            question_id: question.id,
            language_code: lang,
          },
        },
        update: { prompt: t.prompt, helper_text: ("helper_text" in t ? t.helper_text : null) ?? null },
        create: {
          question_id: question.id,
          language_code: lang,
          prompt: t.prompt,
          helper_text: ("helper_text" in t ? t.helper_text : null) ?? null,
        },
      });
    }

    if ("options" in q && q.options) {
      for (let i = 0; i < q.options.length; i++) {
        const opt = q.options[i]!;
        const option = await db.answer_options.upsert({
          where: {
            question_id_option_key: {
              question_id: question.id,
              option_key: opt.key,
            },
          },
          update: { display_order: i, value: opt.key },
          create: {
            question_id: question.id,
            option_key: opt.key,
            value: opt.key,
            display_order: i,
          },
        });
        for (const lang of ["en", "es"] as const) {
          await db.answer_option_translations.upsert({
            where: {
              option_id_language_code: {
                option_id: option.id,
                language_code: lang,
              },
            },
            update: { label: opt[lang] },
            create: {
              option_id: option.id,
              language_code: lang,
              label: opt[lang],
            },
          });
        }
      }
    }
  }

  // ---- Eligibility rule (one trivial rule per program) --------------------
  // Just enough for eligibility.run to have something to evaluate.
  // The actual rule engine is for tomorrow; this is placeholder structure.
  for (const program of [snap, medicaid]) {
    const existing = await db.eligibility_rule_versions.findFirst({
      where: { program_id: program.id, version: 1 },
    });
    if (!existing) {
      await db.eligibility_rule_versions.create({
        data: {
          program_id: program.id,
          version: 1,
          rules_json: {
            // Placeholder: a real rule engine will parse these.
            outcome: "may_be_eligible",
            reasons: ["Eligibility cannot be determined from screener alone."],
          },
          effective_from: new Date(),
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
