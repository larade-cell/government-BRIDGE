/**
 * Reference-data seed for BRIDGE.
 *
 * Idempotent: every entity is upserted by a natural key (`code`, `program_key`,
 * `doc_key`, `question_key`, etc.) so running this multiple times is safe.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PROGRAM_RULES } from "../src/server/lib/eligibility/programRules";

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

  // ---- Demo staff accounts ------------------------------------------------
  // Domain users with elevated roles, keyed by email. Because the magic-link
  // provider prints the sign-in link to the console in dev, you can log in as
  // these accounts without real email delivery: enter the address on
  // /auth/magic-link and follow the printed link. On first sign-in the
  // createUser event links the NextAuth user to the existing row by email, so
  // the seeded role is preserved. Use `tsx scripts/set-role.ts <email> <role>`
  // to promote any other account.
  const demoStaff = [
    { email: "admin@bridge.local", role: "admin" as const },
    { email: "caseworker@bridge.local", role: "caseworker" as const },
  ];
  for (const s of demoStaff) {
    await db.users.upsert({
      where: { email: s.email },
      update: { role: s.role },
      create: { email: s.email, role: s.role, preferred_language: "en" },
    });
  }

  // ---- Programs -----------------------------------------------------------
  // Major federal benefit programs across food, healthcare, cash, housing,
  // utilities, tax credits, education, and childcare. Each carries bilingual
  // (en/es) translations. The screener surfaces these as candidate programs;
  // the rule engine (placeholder below) refines the eligibility outcome.
  const programSeeds = [
    {
      key: "snap",
      category: "food",
      url: "https://www.fns.usda.gov/snap/",
      en: {
        name: "SNAP (Food Stamps)",
        short_description:
          "Federal food assistance for low-income households to help buy groceries.",
        next_steps:
          "Apply through your state's SNAP office. Bring proof of income, ID, and residency.",
      },
      es: {
        name: "SNAP (Cupones de Alimentos)",
        short_description:
          "Asistencia alimentaria federal para hogares de bajos ingresos para ayudar a comprar comestibles.",
        next_steps:
          "Solicite a través de la oficina estatal de SNAP. Traiga prueba de ingresos, identificación y residencia.",
      },
    },
    {
      key: "medicaid",
      category: "healthcare",
      url: "https://www.medicaid.gov/",
      en: {
        name: "Medicaid",
        short_description:
          "Free or low-cost health coverage for eligible low-income adults, children, pregnant people, and people with disabilities.",
        next_steps:
          "Apply through your state's Medicaid agency or HealthCare.gov.",
      },
      es: {
        name: "Medicaid",
        short_description:
          "Cobertura médica gratuita o de bajo costo para adultos, niños, personas embarazadas y personas con discapacidades de bajos ingresos.",
        next_steps:
          "Solicite a través de la agencia de Medicaid de su estado o en HealthCare.gov.",
      },
    },
    {
      key: "tanf",
      category: "cash",
      url: "https://www.acf.hhs.gov/ofa/programs/tanf",
      en: {
        name: "TANF (Cash Assistance)",
        short_description:
          "Temporary monthly cash assistance for low-income families with children to cover basic needs.",
        next_steps:
          "Apply through your state's TANF or human services office. Bring proof of income, household members, and ID.",
      },
      es: {
        name: "TANF (Asistencia en Efectivo)",
        short_description:
          "Asistencia temporal en efectivo cada mes para familias de bajos ingresos con hijos para cubrir necesidades básicas.",
        next_steps:
          "Solicite a través de la oficina de TANF o de servicios humanos de su estado. Traiga prueba de ingresos, miembros del hogar e identificación.",
      },
    },
    {
      key: "wic",
      category: "food",
      url: "https://www.fns.usda.gov/wic",
      en: {
        name: "WIC",
        short_description:
          "Nutrition support for pregnant people, new mothers, infants, and children under 5, including healthy food and breastfeeding help.",
        next_steps:
          "Contact your local WIC clinic to schedule an appointment. Bring proof of income, ID, and the child's records.",
      },
      es: {
        name: "WIC",
        short_description:
          "Apoyo nutricional para personas embarazadas, madres recientes, bebés y niños menores de 5 años, incluyendo alimentos saludables y ayuda con la lactancia.",
        next_steps:
          "Comuníquese con su clínica local de WIC para programar una cita. Traiga prueba de ingresos, identificación y los registros del niño.",
      },
    },
    {
      key: "ssi",
      category: "cash",
      url: "https://www.ssa.gov/ssi/",
      en: {
        name: "SSI (Supplemental Security Income)",
        short_description:
          "Monthly payments for people who are 65+, blind, or have a disability and have very limited income and resources.",
        next_steps:
          "Apply with the Social Security Administration online, by phone, or at a local office.",
      },
      es: {
        name: "SSI (Seguridad de Ingreso Suplementario)",
        short_description:
          "Pagos mensuales para personas de 65 años o más, ciegas o con una discapacidad y con ingresos y recursos muy limitados.",
        next_steps:
          "Solicite con la Administración del Seguro Social en línea, por teléfono o en una oficina local.",
      },
    },
    {
      key: "chip",
      category: "healthcare",
      url: "https://www.healthcare.gov/medicaid-chip/childrens-health-insurance-program/",
      en: {
        name: "CHIP (Children's Health Insurance)",
        short_description:
          "Low-cost health coverage for children in families that earn too much for Medicaid but cannot afford private insurance.",
        next_steps:
          "Apply through your state's Medicaid/CHIP agency or HealthCare.gov.",
      },
      es: {
        name: "CHIP (Seguro Médico para Niños)",
        short_description:
          "Cobertura médica de bajo costo para niños en familias que ganan demasiado para Medicaid pero no pueden pagar un seguro privado.",
        next_steps:
          "Solicite a través de la agencia de Medicaid/CHIP de su estado o en HealthCare.gov.",
      },
    },
    {
      key: "liheap",
      category: "utilities",
      url: "https://www.acf.hhs.gov/ocs/programs/liheap",
      en: {
        name: "LIHEAP (Energy Assistance)",
        short_description:
          "Help paying heating and cooling bills and energy emergencies for low-income households.",
        next_steps:
          "Apply through your state or local LIHEAP office. Bring recent utility bills and proof of income.",
      },
      es: {
        name: "LIHEAP (Asistencia de Energía)",
        short_description:
          "Ayuda para pagar facturas de calefacción y enfriamiento y emergencias de energía para hogares de bajos ingresos.",
        next_steps:
          "Solicite a través de su oficina estatal o local de LIHEAP. Traiga facturas recientes de servicios públicos y prueba de ingresos.",
      },
    },
    {
      key: "housing_choice_voucher",
      category: "housing",
      url: "https://www.hud.gov/topics/housing_choice_voucher_program_section_8",
      en: {
        name: "Housing Choice Voucher (Section 8)",
        short_description:
          "Rental assistance that helps low-income families, seniors, and people with disabilities afford housing in the private market.",
        next_steps:
          "Contact your local public housing agency (PHA) to apply or join the waiting list.",
      },
      es: {
        name: "Vale de Elección de Vivienda (Sección 8)",
        short_description:
          "Asistencia de alquiler que ayuda a familias de bajos ingresos, personas mayores y personas con discapacidades a pagar vivienda en el mercado privado.",
        next_steps:
          "Comuníquese con su agencia local de vivienda pública (PHA) para solicitar o unirse a la lista de espera.",
      },
    },
    {
      key: "eitc",
      category: "tax",
      url: "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc",
      en: {
        name: "Earned Income Tax Credit (EITC)",
        short_description:
          "A refundable tax credit for low-to-moderate-income workers that can mean a larger tax refund.",
        next_steps:
          "Claim it when you file your federal tax return. Free filing help is available through VITA sites.",
      },
      es: {
        name: "Crédito Tributario por Ingreso del Trabajo (EITC)",
        short_description:
          "Un crédito tributario reembolsable para trabajadores de ingresos bajos a moderados que puede significar un reembolso de impuestos mayor.",
        next_steps:
          "Reclámelo cuando presente su declaración de impuestos federal. Hay ayuda gratuita para declarar a través de los sitios de VITA.",
      },
    },
    {
      key: "ctc",
      category: "tax",
      url: "https://www.irs.gov/credits-deductions/individuals/child-tax-credit",
      en: {
        name: "Child Tax Credit (CTC)",
        short_description:
          "A tax credit for families with qualifying children under 17 that reduces taxes owed and may be partly refundable.",
        next_steps:
          "Claim it when you file your federal tax return, even if you don't normally file.",
      },
      es: {
        name: "Crédito Tributario por Hijos (CTC)",
        short_description:
          "Un crédito tributario para familias con hijos calificados menores de 17 años que reduce los impuestos adeudados y puede ser parcialmente reembolsable.",
        next_steps:
          "Reclámelo cuando presente su declaración de impuestos federal, incluso si normalmente no declara.",
      },
    },
    {
      key: "lifeline",
      category: "utilities",
      url: "https://www.fcc.gov/lifeline-consumers",
      en: {
        name: "Lifeline (Phone & Internet)",
        short_description:
          "A monthly discount on phone or internet service for qualifying low-income households.",
        next_steps:
          "Check eligibility and apply at LifelineSupport.org, then choose a participating provider.",
      },
      es: {
        name: "Lifeline (Teléfono e Internet)",
        short_description:
          "Un descuento mensual en el servicio de teléfono o internet para hogares de bajos ingresos que califican.",
        next_steps:
          "Verifique su elegibilidad y solicite en LifelineSupport.org, luego elija un proveedor participante.",
      },
    },
    {
      key: "school_meals",
      category: "food",
      url: "https://www.fns.usda.gov/nslp",
      en: {
        name: "Free & Reduced-Price School Meals",
        short_description:
          "Free or low-cost breakfast and lunch at school for children in eligible households.",
        next_steps:
          "Submit a meal application through your child's school or district. Many families qualify automatically through SNAP or TANF.",
      },
      es: {
        name: "Comidas Escolares Gratuitas y a Precio Reducido",
        short_description:
          "Desayuno y almuerzo gratuitos o de bajo costo en la escuela para niños en hogares elegibles.",
        next_steps:
          "Presente una solicitud de comidas a través de la escuela o el distrito de su hijo. Muchas familias califican automáticamente a través de SNAP o TANF.",
      },
    },
    {
      key: "unemployment_insurance",
      category: "cash",
      url: "https://www.dol.gov/general/topic/unemployment-insurance",
      en: {
        name: "Unemployment Insurance",
        short_description:
          "Temporary income for workers who lost their job through no fault of their own and are able and available to work.",
        next_steps:
          "File a claim with your state's unemployment agency as soon as you lose work. Have your work history ready.",
      },
      es: {
        name: "Seguro de Desempleo",
        short_description:
          "Ingreso temporal para trabajadores que perdieron su empleo sin culpa propia y que pueden y están disponibles para trabajar.",
        next_steps:
          "Presente una reclamación con la agencia de desempleo de su estado tan pronto como pierda el trabajo. Tenga lista su historia laboral.",
      },
    },
    {
      key: "aca_marketplace",
      category: "healthcare",
      url: "https://www.healthcare.gov/",
      en: {
        name: "ACA Marketplace Subsidies",
        short_description:
          "Premium tax credits and cost-sharing reductions that lower the cost of Marketplace health insurance.",
        next_steps:
          "Compare plans and apply at HealthCare.gov during open enrollment or after a qualifying life event.",
      },
      es: {
        name: "Subsidios del Mercado de ACA",
        short_description:
          "Créditos fiscales para primas y reducciones de costos compartidos que reducen el costo del seguro médico del Mercado.",
        next_steps:
          "Compare planes y solicite en CuidadoDeSalud.gov durante la inscripción abierta o después de un evento de vida calificado.",
      },
    },
    {
      key: "head_start",
      category: "education",
      url: "https://www.acf.hhs.gov/ohs",
      en: {
        name: "Head Start / Early Head Start",
        short_description:
          "Free early learning, health, and family support for pregnant people and children under 5 from low-income families.",
        next_steps:
          "Find and contact your local Head Start program to enroll. Bring proof of income and your child's age.",
      },
      es: {
        name: "Head Start / Early Head Start",
        short_description:
          "Aprendizaje temprano, salud y apoyo familiar gratuitos para personas embarazadas y niños menores de 5 años de familias de bajos ingresos.",
        next_steps:
          "Encuentre y comuníquese con su programa local de Head Start para inscribirse. Traiga prueba de ingresos y la edad de su hijo.",
      },
    },
    {
      key: "pell_grant",
      category: "education",
      url: "https://studentaid.gov/understand-aid/types/grants/pell",
      en: {
        name: "Federal Pell Grant",
        short_description:
          "Grant money for low-income undergraduate students that does not have to be repaid.",
        next_steps:
          "Complete the FAFSA at studentaid.gov to apply for federal student aid, including the Pell Grant.",
      },
      es: {
        name: "Beca Federal Pell",
        short_description:
          "Dinero de beca para estudiantes universitarios de bajos ingresos que no tiene que devolverse.",
        next_steps:
          "Complete la FAFSA en studentaid.gov para solicitar ayuda federal estudiantil, incluida la Beca Pell.",
      },
    },
    {
      key: "ccdf",
      category: "childcare",
      url: "https://www.acf.hhs.gov/occ",
      en: {
        name: "Child Care Assistance (CCDF)",
        short_description:
          "Help paying for child care so parents can work, look for work, or attend school or training.",
        next_steps:
          "Apply through your state's child care assistance or human services agency. Bring proof of work or school and income.",
      },
      es: {
        name: "Asistencia para el Cuidado Infantil (CCDF)",
        short_description:
          "Ayuda para pagar el cuidado infantil para que los padres puedan trabajar, buscar trabajo o asistir a la escuela o capacitación.",
        next_steps:
          "Solicite a través de la agencia de asistencia para el cuidado infantil o de servicios humanos de su estado. Traiga prueba de trabajo o escuela e ingresos.",
      },
    },
    {
      key: "va_health",
      category: "healthcare",
      url: "https://www.va.gov/health-care/",
      en: {
        name: "VA Health Care",
        short_description:
          "Comprehensive health coverage and services for eligible Veterans, including primary care, mental health, and prescriptions.",
        next_steps:
          "Apply online at VA.gov, by phone, or at a VA medical center. Have your discharge papers (DD214) ready.",
      },
      es: {
        name: "Atención Médica del VA",
        short_description:
          "Cobertura y servicios médicos integrales para veteranos elegibles, incluyendo atención primaria, salud mental y recetas.",
        next_steps:
          "Solicite en línea en VA.gov, por teléfono o en un centro médico del VA. Tenga listos sus documentos de baja (DD214).",
      },
    },
  ];

  const createdPrograms = [];
  for (const p of programSeeds) {
    const program = await db.programs.upsert({
      where: { program_key: p.key },
      update: { category: p.category, authoritative_url: p.url },
      create: {
        program_key: p.key,
        category: p.category,
        authoritative_url: p.url,
      },
    });

    for (const lang of ["en", "es"] as const) {
      const t = p[lang];
      await db.program_translations.upsert({
        where: {
          program_id_language_code: {
            program_id: program.id,
            language_code: lang,
          },
        },
        update: {
          name: t.name,
          short_description: t.short_description,
          next_steps: t.next_steps,
        },
        create: {
          program_id: program.id,
          language_code: lang,
          name: t.name,
          short_description: t.short_description,
          next_steps: t.next_steps,
        },
      });
    }

    createdPrograms.push(program);
  }

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
  // A detailed screener: enough signal to surface candidate programs across
  // food, healthcare, cash, housing, utilities, tax, education, and childcare.
  // Grouped by household composition, income & resources, status, and
  // circumstances. Answer types are limited to those the questionnaire UI can
  // render: integer, decimal, boolean, single_select, and text.
  const questionSeeds = [
    // --- Household composition ---
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
      question_key: "num_children_under_18",
      answer_type: "integer",
      display_order: 2,
      prompts: {
        en: {
          prompt: "How many children under 18 live in your household?",
          helper_text: "Enter 0 if none.",
        },
        es: {
          prompt: "¿Cuántos niños menores de 18 años viven en su hogar?",
          helper_text: "Ingrese 0 si ninguno.",
        },
      },
    },
    {
      question_key: "num_adults_60_plus",
      answer_type: "integer",
      display_order: 3,
      prompts: {
        en: {
          prompt: "How many people in your household are 60 or older?",
          helper_text: "Enter 0 if none.",
        },
        es: {
          prompt: "¿Cuántas personas en su hogar tienen 60 años o más?",
          helper_text: "Ingrese 0 si ninguna.",
        },
      },
    },
    {
      question_key: "applicant_age",
      answer_type: "integer",
      display_order: 4,
      prompts: {
        en: { prompt: "How old are you?" },
        es: { prompt: "¿Cuántos años tiene usted?" },
      },
    },
    {
      question_key: "marital_status",
      answer_type: "single_select",
      display_order: 5,
      prompts: {
        en: { prompt: "What is your marital status?" },
        es: { prompt: "¿Cuál es su estado civil?" },
      },
      options: [
        { key: "single", en: "Single", es: "Soltero/a" },
        { key: "married", en: "Married", es: "Casado/a" },
        { key: "domestic_partnership", en: "Domestic partnership", es: "Unión de hecho" },
        { key: "separated", en: "Separated", es: "Separado/a" },
        { key: "divorced", en: "Divorced", es: "Divorciado/a" },
        { key: "widowed", en: "Widowed", es: "Viudo/a" },
      ],
    },
    {
      question_key: "state_residence",
      answer_type: "text",
      display_order: 6,
      prompts: {
        en: {
          prompt: "What state do you live in?",
          helper_text: "Many programs are run by your state, so eligibility can vary.",
        },
        es: {
          prompt: "¿En qué estado vive?",
          helper_text: "Muchos programas son administrados por su estado, por lo que la elegibilidad puede variar.",
        },
      },
    },

    // --- Income & resources ---
    {
      question_key: "employment_status",
      answer_type: "single_select",
      display_order: 7,
      prompts: {
        en: { prompt: "What best describes your current work situation?" },
        es: { prompt: "¿Qué describe mejor su situación laboral actual?" },
      },
      options: [
        { key: "employed_full_time", en: "Employed full-time", es: "Empleado/a a tiempo completo" },
        { key: "employed_part_time", en: "Employed part-time", es: "Empleado/a a tiempo parcial" },
        { key: "self_employed", en: "Self-employed", es: "Trabajador/a por cuenta propia" },
        { key: "unemployed", en: "Unemployed and looking for work", es: "Desempleado/a y buscando trabajo" },
        { key: "unable_to_work", en: "Unable to work", es: "No puedo trabajar" },
        { key: "retired", en: "Retired", es: "Jubilado/a" },
        { key: "not_working", en: "Not working", es: "Sin trabajar" },
      ],
    },
    {
      question_key: "monthly_household_income",
      answer_type: "decimal",
      display_order: 8,
      prompts: {
        en: {
          prompt: "What is your household's total monthly income before taxes?",
          helper_text: "Include wages, benefits, child support — everyone in the household.",
        },
        es: {
          prompt: "¿Cuál es el ingreso mensual total de su hogar antes de impuestos?",
          helper_text: "Incluya salarios, beneficios y manutención infantil — de todos en el hogar.",
        },
      },
    },
    {
      question_key: "monthly_earned_income",
      answer_type: "decimal",
      display_order: 9,
      prompts: {
        en: {
          prompt: "Of that, how much comes from work (wages or self-employment) each month?",
          helper_text: "Enter 0 if no one in the household works.",
        },
        es: {
          prompt: "De eso, ¿cuánto proviene del trabajo (salarios o trabajo por cuenta propia) cada mes?",
          helper_text: "Ingrese 0 si nadie en el hogar trabaja.",
        },
      },
    },
    {
      question_key: "monthly_unearned_income",
      answer_type: "decimal",
      display_order: 10,
      prompts: {
        en: {
          prompt: "How much monthly income comes from benefits, Social Security, pensions, or child support?",
          helper_text: "Enter 0 if none.",
        },
        es: {
          prompt: "¿Cuánto ingreso mensual proviene de beneficios, Seguro Social, pensiones o manutención infantil?",
          helper_text: "Ingrese 0 si ninguno.",
        },
      },
    },
    {
      question_key: "household_assets",
      answer_type: "decimal",
      display_order: 11,
      prompts: {
        en: {
          prompt: "About how much does your household have in savings, checking, and cash?",
          helper_text: "A rough estimate is fine. Do not count your home or one vehicle.",
        },
        es: {
          prompt: "¿Aproximadamente cuánto tiene su hogar en ahorros, cuenta corriente y efectivo?",
          helper_text: "Una estimación aproximada está bien. No cuente su casa ni un vehículo.",
        },
      },
    },

    // --- Status & eligibility ---
    {
      question_key: "citizenship_status",
      answer_type: "single_select",
      display_order: 12,
      prompts: {
        en: { prompt: "What is your citizenship or immigration status?" },
        es: { prompt: "¿Cuál es su estado de ciudadanía o inmigración?" },
      },
      options: [
        { key: "us_citizen", en: "U.S. citizen", es: "Ciudadano/a estadounidense" },
        { key: "permanent_resident", en: "Permanent resident (green card)", es: "Residente permanente (tarjeta verde)" },
        { key: "refugee_or_asylee", en: "Refugee or asylee", es: "Refugiado/a o asilado/a" },
        { key: "other_qualified", en: "Other qualified immigrant", es: "Otro/a inmigrante calificado/a" },
        { key: "none_of_these", en: "None of these / prefer not to say", es: "Ninguno de estos / prefiero no decir" },
      ],
    },
    {
      question_key: "is_pregnant",
      answer_type: "boolean",
      display_order: 13,
      prompts: {
        en: { prompt: "Are you or anyone in your household currently pregnant?" },
        es: { prompt: "¿Está usted o alguien en su hogar embarazada actualmente?" },
      },
    },
    {
      question_key: "has_disability",
      answer_type: "boolean",
      display_order: 14,
      prompts: {
        en: {
          prompt: "Does anyone in your household have a disability or is blind?",
        },
        es: {
          prompt: "¿Alguien en su hogar tiene una discapacidad o es ciego?",
        },
      },
    },
    {
      question_key: "is_veteran",
      answer_type: "boolean",
      display_order: 15,
      prompts: {
        en: {
          prompt: "Are you or your spouse a veteran or currently serving in the military?",
        },
        es: {
          prompt: "¿Es usted o su cónyuge veterano/a o sirve actualmente en el ejército?",
        },
      },
    },
    {
      question_key: "is_college_student",
      answer_type: "boolean",
      display_order: 16,
      prompts: {
        en: {
          prompt: "Are you or anyone in your household enrolled in college or a training program?",
        },
        es: {
          prompt: "¿Está usted o alguien en su hogar inscrito en la universidad o en un programa de capacitación?",
        },
      },
    },

    // --- Circumstances & expenses ---
    {
      question_key: "housing_status",
      answer_type: "single_select",
      display_order: 17,
      prompts: {
        en: { prompt: "What is your current housing situation?" },
        es: { prompt: "¿Cuál es su situación de vivienda actual?" },
      },
      options: [
        { key: "rent", en: "I rent", es: "Alquilo" },
        { key: "own", en: "I own my home", es: "Soy dueño/a de mi casa" },
        { key: "staying_with_family", en: "Staying with family or friends", es: "Me quedo con familia o amigos" },
        { key: "shelter_or_transitional", en: "In a shelter or transitional housing", es: "En un refugio o vivienda de transición" },
        { key: "homeless", en: "Homeless or unstably housed", es: "Sin hogar o vivienda inestable" },
      ],
    },
    {
      question_key: "monthly_housing_cost",
      answer_type: "decimal",
      display_order: 18,
      prompts: {
        en: {
          prompt: "How much do you pay for rent or mortgage each month?",
          helper_text: "Enter 0 if you do not pay rent or a mortgage.",
        },
        es: {
          prompt: "¿Cuánto paga de alquiler o hipoteca cada mes?",
          helper_text: "Ingrese 0 si no paga alquiler ni hipoteca.",
        },
      },
    },
    {
      question_key: "behind_on_utilities",
      answer_type: "boolean",
      display_order: 19,
      prompts: {
        en: {
          prompt: "Are you behind on utility bills or at risk of having service shut off?",
        },
        es: {
          prompt: "¿Está atrasado en las facturas de servicios públicos o en riesgo de que le corten el servicio?",
        },
      },
    },
    {
      question_key: "has_high_medical_expenses",
      answer_type: "boolean",
      display_order: 20,
      prompts: {
        en: {
          prompt: "Does your household have high out-of-pocket medical or prescription costs?",
        },
        es: {
          prompt: "¿Tiene su hogar costos médicos o de recetas elevados pagados de su bolsillo?",
        },
      },
    },
    {
      question_key: "pays_dependent_care",
      answer_type: "boolean",
      display_order: 21,
      prompts: {
        en: {
          prompt: "Do you pay for child care or care for an adult dependent?",
        },
        es: {
          prompt: "¿Paga por el cuidado de niños o el cuidado de un adulto dependiente?",
        },
      },
    },
    {
      question_key: "filed_taxes_last_year",
      answer_type: "boolean",
      display_order: 22,
      prompts: {
        en: {
          prompt: "Did you file a federal tax return last year?",
          helper_text: "Some credits, like the EITC and Child Tax Credit, are claimed through taxes.",
        },
        es: {
          prompt: "¿Presentó una declaración de impuestos federal el año pasado?",
          helper_text: "Algunos créditos, como el EITC y el Crédito Tributario por Hijos, se reclaman a través de los impuestos.",
        },
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

    const prompts = Object.entries(q.prompts) as [
      string,
      { prompt: string; helper_text?: string },
    ][];
    for (const [lang, t] of prompts) {
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

  // ---- Eligibility rules (version 1 per program) --------------------------
  // The real, structured rules live in `PROGRAM_RULES` (shared with the
  // runtime engine in src/server/lib/eligibility). We write them verbatim into
  // `rules_json`; `eligibility.run` reads them back and evaluates them against
  // each session's answers. Programs without a defined rule set fall back to a
  // minimal placeholder so the engine returns `needs_more_info` for them.
  for (const program of createdPrograms) {
    const rules = PROGRAM_RULES[program.program_key] ?? {
      requirements: [],
    };
    const rulesJson = JSON.parse(JSON.stringify(rules)) as object;
    await db.eligibility_rule_versions.upsert({
      where: {
        program_id_version: { program_id: program.id, version: 1 },
      },
      update: { rules_json: rulesJson },
      create: {
        program_id: program.id,
        version: 1,
        rules_json: rulesJson,
        effective_from: new Date(),
      },
    });
  }

  // ---- Knowledge base -----------------------------------------------------
  // Starter RAG sources for the eligibility chatbot. Each is grounded in an
  // official page; the chatbot retrieves these (after embedding via
  // `npm run backfill:embeddings`) and cites them. Bilingual (en/es).
  // Idempotent: keyed by (source_url, language_code).
  const programIdByKey: Record<string, string> = Object.fromEntries(
    createdPrograms.map((p) => [p.program_key, p.id]),
  );

  // ---- Document types & per-program requirements --------------------------
  // The screener turns each session's eligible programs into a personalized
  // document checklist (see generateSessionChecklist in
  // src/server/api/helpers/document-checklist.ts). That mapping draws on two
  // reference tables seeded here: the bilingual catalog of document types, and
  // — per program — which of those documents an applicant must provide.
  // Realistic but not exhaustive; tune against each agency's current guidance.
  const documentTypeSeeds: {
    key: string;
    category: string;
    en: { name: string; description: string; examples: string };
    es: { name: string; description: string; examples: string };
  }[] = [
    {
      key: "photo_id",
      category: "identity",
      en: {
        name: "Government-issued photo ID",
        description: "A current photo ID that proves who you are.",
        examples: "Driver's license, state ID card, or U.S. passport",
      },
      es: {
        name: "Identificación con foto del gobierno",
        description:
          "Una identificación con foto vigente que comprueba quién es usted.",
        examples:
          "Licencia de conducir, tarjeta de identificación estatal o pasaporte de EE. UU.",
      },
    },
    {
      key: "ssn_card",
      category: "identity",
      en: {
        name: "Social Security number",
        description: "Proof of your Social Security number.",
        examples:
          "Social Security card or an official SSA letter showing your number",
      },
      es: {
        name: "Número de Seguro Social",
        description: "Comprobante de su número de Seguro Social.",
        examples:
          "Tarjeta de Seguro Social o una carta oficial de la SSA con su número",
      },
    },
    {
      key: "proof_of_income",
      category: "income",
      en: {
        name: "Proof of income",
        description: "Recent documentation of money you earn or receive.",
        examples:
          "Pay stubs from the last 30 days, an employer letter, or a benefit award letter",
      },
      es: {
        name: "Comprobante de ingresos",
        description: "Documentación reciente del dinero que gana o recibe.",
        examples:
          "Talones de pago de los últimos 30 días, carta del empleador o carta de adjudicación de beneficios",
      },
    },
    {
      key: "paystub",
      category: "income",
      en: {
        name: "Recent pay stub",
        description: "A pay stub showing your current wages.",
        examples: "Your two most recent pay stubs from each employer",
      },
      es: {
        name: "Talón de pago reciente",
        description: "Un talón de pago que muestre su salario actual.",
        examples: "Sus dos talones de pago más recientes de cada empleador",
      },
    },
    {
      key: "proof_of_residency",
      category: "residency",
      en: {
        name: "Proof of residency",
        description: "A document showing where you currently live.",
        examples:
          "Utility bill, signed lease, or mortgage statement with your address",
      },
      es: {
        name: "Comprobante de residencia",
        description: "Un documento que muestre dónde vive actualmente.",
        examples:
          "Factura de servicios, contrato de arrendamiento firmado o estado de cuenta hipotecario con su dirección",
      },
    },
    {
      key: "proof_of_citizenship",
      category: "status",
      en: {
        name: "Proof of citizenship or immigration status",
        description:
          "Documentation of your U.S. citizenship or lawful immigration status.",
        examples:
          "Birth certificate, U.S. passport, naturalization certificate, or USCIS document",
      },
      es: {
        name: "Comprobante de ciudadanía o estatus migratorio",
        description:
          "Documentación de su ciudadanía estadounidense o estatus migratorio legal.",
        examples:
          "Acta de nacimiento, pasaporte de EE. UU., certificado de naturalización o documento de USCIS",
      },
    },
    {
      key: "proof_of_household",
      category: "household",
      en: {
        name: "Proof of household members",
        description: "Documents that confirm who lives in your home.",
        examples:
          "Birth certificates of dependents, school records, or a household statement",
      },
      es: {
        name: "Comprobante de integrantes del hogar",
        description: "Documentos que confirman quién vive en su hogar.",
        examples:
          "Actas de nacimiento de dependientes, registros escolares o una declaración del hogar",
      },
    },
    {
      key: "bank_statements",
      category: "resources",
      en: {
        name: "Bank statements",
        description: "Recent statements for your accounts.",
        examples: "The last two months of checking and savings statements",
      },
      es: {
        name: "Estados de cuenta bancarios",
        description: "Estados de cuenta recientes de sus cuentas.",
        examples:
          "Los últimos dos meses de estados de cuenta corriente y de ahorros",
      },
    },
    {
      key: "proof_of_expenses",
      category: "expenses",
      en: {
        name: "Proof of expenses",
        description:
          "Bills that may affect your eligibility or benefit amount.",
        examples: "Rent or mortgage, utility, childcare, or medical bills",
      },
      es: {
        name: "Comprobante de gastos",
        description:
          "Facturas que pueden afectar su elegibilidad o el monto del beneficio.",
        examples:
          "Renta o hipoteca, servicios públicos, cuidado infantil o facturas médicas",
      },
    },
    {
      key: "tax_return",
      category: "income",
      en: {
        name: "Federal tax return",
        description: "Your most recent filed federal tax return.",
        examples: "Form 1040 from the most recent tax year",
      },
      es: {
        name: "Declaración de impuestos federales",
        description: "Su declaración de impuestos federales más reciente.",
        examples: "Formulario 1040 del año fiscal más reciente",
      },
    },
    {
      key: "proof_of_disability",
      category: "status",
      en: {
        name: "Proof of disability",
        description: "Documentation of a qualifying disability.",
        examples: "A doctor's statement or an SSA disability award letter",
      },
      es: {
        name: "Comprobante de discapacidad",
        description: "Documentación de una discapacidad que califica.",
        examples:
          "Una declaración del médico o una carta de adjudicación de discapacidad de la SSA",
      },
    },
    {
      key: "birth_certificate",
      category: "identity",
      en: {
        name: "Birth certificate",
        description:
          "A certified birth certificate for the applicant or children.",
        examples: "Certified copy issued by a state or county",
      },
      es: {
        name: "Acta de nacimiento",
        description:
          "Un acta de nacimiento certificada del solicitante o de los niños.",
        examples: "Copia certificada emitida por un estado o condado",
      },
    },
    {
      key: "proof_of_pregnancy",
      category: "status",
      en: {
        name: "Proof of pregnancy",
        description: "A medical document confirming pregnancy.",
        examples: "A clinic or doctor's statement with your due date",
      },
      es: {
        name: "Comprobante de embarazo",
        description: "Un documento médico que confirme el embarazo.",
        examples:
          "Una declaración de la clínica o del médico con su fecha probable de parto",
      },
    },
    {
      key: "military_discharge",
      category: "status",
      en: {
        name: "Military discharge papers",
        description: "Proof of military service and discharge status.",
        examples: "DD-214 form or equivalent service record",
      },
      es: {
        name: "Documentos de baja militar",
        description: "Comprobante del servicio militar y el estatus de baja.",
        examples: "Formulario DD-214 o registro de servicio equivalente",
      },
    },
  ];

  for (const d of documentTypeSeeds) {
    const docType = await db.document_types.upsert({
      where: { doc_key: d.key },
      update: { category: d.category },
      create: { doc_key: d.key, category: d.category },
    });
    for (const lang of ["en", "es"] as const) {
      const t = d[lang];
      await db.document_type_translations.upsert({
        where: {
          document_type_id_language_code: {
            document_type_id: docType.id,
            language_code: lang,
          },
        },
        update: {
          name: t.name,
          description: t.description,
          examples: t.examples,
        },
        create: {
          document_type_id: docType.id,
          language_code: lang,
          name: t.name,
          description: t.description,
          examples: t.examples,
        },
      });
    }
  }

  // doc_key -> id, for wiring the per-program requirements below.
  const docTypeIdByKey: Record<string, string> = Object.fromEntries(
    (
      await db.document_types.findMany({
        select: { id: true, doc_key: true },
      })
    ).map((d) => [d.doc_key, d.id]),
  );

  // Per-program required documents, keyed by program_key. Every listed doc_key
  // becomes a required `program_document_requirements` row, which the checklist
  // generator turns into a checklist item for any session eligible for that
  // program.
  const programRequirements: Record<string, string[]> = {
    snap: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_residency",
      "proof_of_expenses",
    ],
    medicaid: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_citizenship",
      "proof_of_residency",
    ],
    va_health: ["photo_id", "military_discharge", "proof_of_income"],
    ssi: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_disability",
      "bank_statements",
      "proof_of_citizenship",
    ],
    liheap: [
      "photo_id",
      "proof_of_income",
      "proof_of_residency",
      "proof_of_expenses",
    ],
    housing_choice_voucher: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_citizenship",
      "birth_certificate",
    ],
    ccdf: [
      "photo_id",
      "proof_of_income",
      "proof_of_household",
      "proof_of_residency",
    ],
    eitc: ["tax_return", "ssn_card", "proof_of_income"],
    ctc: ["tax_return", "ssn_card", "proof_of_household"],
    lifeline: ["photo_id", "proof_of_income"],
    chip: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_citizenship",
      "proof_of_household",
    ],
    school_meals: ["proof_of_income", "proof_of_household"],
    unemployment_insurance: ["photo_id", "ssn_card", "proof_of_income"],
    aca_marketplace: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_citizenship",
    ],
    head_start: ["birth_certificate", "proof_of_income", "proof_of_residency"],
    pell_grant: ["tax_return", "ssn_card", "photo_id"],
    tanf: [
      "photo_id",
      "ssn_card",
      "proof_of_income",
      "proof_of_residency",
      "proof_of_household",
      "birth_certificate",
    ],
    wic: [
      "photo_id",
      "proof_of_income",
      "proof_of_residency",
      "birth_certificate",
    ],
  };

  for (const [programKey, docKeys] of Object.entries(programRequirements)) {
    const programId = programIdByKey[programKey];
    if (!programId) continue;
    for (const docKey of docKeys) {
      const documentTypeId = docTypeIdByKey[docKey];
      if (!documentTypeId) continue;
      await db.program_document_requirements.upsert({
        where: {
          program_id_document_type_id: {
            program_id: programId,
            document_type_id: documentTypeId,
          },
        },
        update: { is_required: true },
        create: {
          program_id: programId,
          document_type_id: documentTypeId,
          is_required: true,
        },
      });
    }
  }

  const knowledgeSeeds: {
    program_key?: string;
    source_url: string;
    en: { title: string; content: string };
    es: { title: string; content: string };
  }[] = [
    {
      program_key: "snap",
      source_url: "https://www.fns.usda.gov/snap/recipient/eligibility",
      en: {
        title: "SNAP eligibility basics",
        content:
          "SNAP (food stamps) helps low-income households buy food. Eligibility is based mainly on household size and gross monthly income — generally at or below 130% of the federal poverty level, though many states raise that limit to about 200% under broad-based categorical eligibility. Most adults aged 18–59 must meet work requirements. U.S. citizens and many lawfully present immigrants can qualify. Apply through your state's SNAP agency.",
      },
      es: {
        title: "Conceptos básicos de elegibilidad de SNAP",
        content:
          "SNAP (cupones de alimentos) ayuda a los hogares de bajos ingresos a comprar comida. La elegibilidad depende principalmente del tamaño del hogar y del ingreso mensual bruto — generalmente igual o menor al 130% del nivel federal de pobreza, aunque muchos estados elevan ese límite a cerca del 200%. La mayoría de los adultos de 18 a 59 años deben cumplir requisitos de trabajo. Pueden calificar los ciudadanos estadounidenses y muchos inmigrantes con estatus legal. Solicite a través de la agencia de SNAP de su estado.",
      },
    },
    {
      program_key: "medicaid",
      source_url: "https://www.medicaid.gov/medicaid/eligibility/index.html",
      en: {
        title: "Medicaid eligibility basics",
        content:
          "Medicaid provides free or low-cost health coverage. In states that expanded Medicaid, adults with income up to 138% of the federal poverty level qualify. In states that did not expand, childless adults generally do not qualify regardless of income. Pregnant people, children, parents, seniors, and people with disabilities may qualify at higher limits. Rules vary by state. Apply through your state Medicaid agency or HealthCare.gov.",
      },
      es: {
        title: "Conceptos básicos de elegibilidad de Medicaid",
        content:
          "Medicaid ofrece cobertura médica gratuita o de bajo costo. En los estados que ampliaron Medicaid, califican los adultos con ingresos hasta el 138% del nivel federal de pobreza. En los estados que no lo ampliaron, los adultos sin hijos generalmente no califican sin importar sus ingresos. Las personas embarazadas, los niños, los padres, las personas mayores y las personas con discapacidades pueden calificar con límites más altos. Las reglas varían por estado.",
      },
    },
    {
      program_key: "wic",
      source_url: "https://www.fns.usda.gov/wic/wic-eligibility-requirements",
      en: {
        title: "WIC eligibility",
        content:
          "WIC provides nutrition support to pregnant and postpartum people, infants, and children under age 5. Households generally qualify with income at or below 185% of the federal poverty level, and anyone who receives SNAP, Medicaid, or TANF is automatically income-eligible. A WIC clinic also assesses a nutritional need.",
      },
      es: {
        title: "Elegibilidad de WIC",
        content:
          "WIC ofrece apoyo nutricional a personas embarazadas y posparto, bebés y niños menores de 5 años. Los hogares generalmente califican con ingresos iguales o menores al 185% del nivel federal de pobreza, y quienes reciben SNAP, Medicaid o TANF son elegibles automáticamente por ingresos. Una clínica de WIC también evalúa la necesidad nutricional.",
      },
    },
    {
      program_key: "tanf",
      source_url: "https://www.acf.hhs.gov/ofa/programs/tanf",
      en: {
        title: "TANF cash assistance",
        content:
          "TANF gives temporary monthly cash assistance to low-income families with children. Income limits, payment amounts, and time limits are set by each state and are usually well below the federal poverty level. Recipients typically must take part in work or job-training activities. Apply through your state's human services or TANF office.",
      },
      es: {
        title: "Asistencia en efectivo de TANF",
        content:
          "TANF brinda asistencia temporal en efectivo cada mes a familias de bajos ingresos con hijos. Los límites de ingresos, los montos y los plazos los establece cada estado y suelen estar muy por debajo del nivel federal de pobreza. Los beneficiarios normalmente deben participar en actividades de trabajo o capacitación. Solicite a través de la oficina de servicios humanos o de TANF de su estado.",
      },
    },
    {
      program_key: "ssi",
      source_url: "https://www.ssa.gov/ssi/",
      en: {
        title: "Supplemental Security Income (SSI)",
        content:
          "SSI pays monthly benefits to people who are 65 or older, blind, or have a disability, and who have limited income and resources — generally under $2,000 for an individual or $3,000 for a couple. Your home and usually one vehicle don't count toward the resource limit. Apply with the Social Security Administration online, by phone, or at a local office.",
      },
      es: {
        title: "Seguridad de Ingreso Suplementario (SSI)",
        content:
          "SSI paga beneficios mensuales a personas de 65 años o más, ciegas o con una discapacidad, que tienen ingresos y recursos limitados — generalmente menos de $2,000 para una persona o $3,000 para una pareja. Su vivienda y por lo general un vehículo no cuentan para el límite de recursos. Solicite con la Administración del Seguro Social.",
      },
    },
    {
      program_key: "chip",
      source_url:
        "https://www.healthcare.gov/medicaid-chip/childrens-health-insurance-program/",
      en: {
        title: "CHIP (children's health coverage)",
        content:
          "CHIP covers children in families that earn too much for Medicaid but can't afford private insurance. Income limits vary by state, often reaching 200–400% of the federal poverty level. There must be a child in the household. Apply any time of year through your state's Medicaid/CHIP agency or HealthCare.gov.",
      },
      es: {
        title: "CHIP (cobertura médica para niños)",
        content:
          "CHIP cubre a los niños de familias que ganan demasiado para Medicaid pero no pueden pagar un seguro privado. Los límites de ingresos varían por estado y a menudo llegan al 200–400% del nivel federal de pobreza. Debe haber un niño en el hogar. Solicite en cualquier momento del año.",
      },
    },
    {
      program_key: "liheap",
      source_url: "https://www.acf.hhs.gov/ocs/programs/liheap",
      en: {
        title: "LIHEAP energy assistance",
        content:
          "LIHEAP helps low-income households pay heating and cooling bills and handle energy emergencies like a shut-off notice. Income limits are set by each state (often up to 150% of the federal poverty level or 60% of state median income). Households that get SNAP, TANF, or SSI often qualify automatically. Apply through your state or local LIHEAP office.",
      },
      es: {
        title: "Asistencia de energía de LIHEAP",
        content:
          "LIHEAP ayuda a los hogares de bajos ingresos a pagar facturas de calefacción y enfriamiento y a enfrentar emergencias de energía, como un aviso de corte. Los límites de ingresos los fija cada estado (a menudo hasta el 150% del nivel federal de pobreza). Los hogares que reciben SNAP, TANF o SSI suelen calificar automáticamente.",
      },
    },
    {
      program_key: "eitc",
      source_url:
        "https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit-eitc",
      en: {
        title: "Earned Income Tax Credit (EITC)",
        content:
          "The EITC is a refundable tax credit for low-to-moderate-income workers — it can increase your refund or reduce tax you owe. You must have income from working and meet limits that depend on your filing status and number of qualifying children. You claim it by filing a federal tax return, even if you aren't otherwise required to file. Free help is available at VITA sites.",
      },
      es: {
        title: "Crédito Tributario por Ingreso del Trabajo (EITC)",
        content:
          "El EITC es un crédito tributario reembolsable para trabajadores de ingresos bajos a moderados — puede aumentar su reembolso o reducir los impuestos que debe. Debe tener ingresos del trabajo y cumplir límites que dependen de su estado civil tributario y del número de hijos calificados. Se reclama al presentar una declaración de impuestos federal. Hay ayuda gratuita en los sitios de VITA.",
      },
    },
    {
      program_key: "housing_choice_voucher",
      source_url:
        "https://www.hud.gov/topics/housing_choice_voucher_program_section_8",
      en: {
        title: "Housing Choice Vouchers (Section 8)",
        content:
          "Housing Choice Vouchers help low-income families, seniors, and people with disabilities afford rental housing in the private market. Eligibility is based on area median income (usually below 50%), family size, and citizenship or eligible immigration status. You apply through your local public housing agency (PHA), and waiting lists are common.",
      },
      es: {
        title: "Vales de Elección de Vivienda (Sección 8)",
        content:
          "Los Vales de Elección de Vivienda ayudan a familias de bajos ingresos, personas mayores y personas con discapacidades a pagar vivienda de alquiler en el mercado privado. La elegibilidad se basa en el ingreso medio del área (normalmente menos del 50%), el tamaño de la familia y el estatus de ciudadanía o inmigración elegible. Se solicita a través de la agencia local de vivienda pública (PHA); las listas de espera son comunes.",
      },
    },
    {
      source_url: "https://www.benefits.gov/",
      en: {
        title: "How benefit eligibility works",
        content:
          "Eligibility for most benefits depends on household size, income (often compared to the federal poverty level), age, disability, immigration status, and the state you live in. Many programs let you qualify automatically if you already receive another, like SNAP or Medicaid. This screener gives estimates only — the agency that runs each program makes the final decision when you apply. Benefits.gov is the official place to find programs you may be eligible for.",
      },
      es: {
        title: "Cómo funciona la elegibilidad para los beneficios",
        content:
          "La elegibilidad para la mayoría de los beneficios depende del tamaño del hogar, los ingresos (a menudo comparados con el nivel federal de pobreza), la edad, la discapacidad, el estatus migratorio y el estado donde vive. Muchos programas permiten calificar automáticamente si ya recibe otro, como SNAP o Medicaid. Esta evaluación solo da estimaciones — la agencia que administra cada programa toma la decisión final cuando usted solicita.",
      },
    },
    {
      source_url: "https://www.usa.gov/immigrants-benefits",
      en: {
        title: "Immigration status and benefits",
        content:
          "Many benefits require U.S. citizenship or a qualified immigration status, such as lawful permanent residents (green-card holders), refugees, and asylees. Some programs cover all children or pregnant people regardless of status, and emergency Medicaid and WIC are broadly available. Applying for benefits on behalf of an eligible child generally does not affect a parent's immigration case. Rules vary by program and state.",
      },
      es: {
        title: "Estatus migratorio y beneficios",
        content:
          "Muchos beneficios requieren ciudadanía estadounidense o un estatus migratorio calificado, como residentes permanentes legales (con tarjeta verde), refugiados y asilados. Algunos programas cubren a todos los niños o personas embarazadas sin importar su estatus, y el Medicaid de emergencia y WIC están ampliamente disponibles. Solicitar beneficios para un hijo elegible generalmente no afecta el caso migratorio de un padre. Las reglas varían por programa y estado.",
      },
    },
  ];

  for (const k of knowledgeSeeds) {
    const program_id = k.program_key
      ? (programIdByKey[k.program_key] ?? null)
      : null;
    for (const lang of ["en", "es"] as const) {
      const existing = await db.knowledge_sources.findFirst({
        where: { source_url: k.source_url, language_code: lang },
        select: { id: true },
      });
      if (existing) {
        await db.knowledge_sources.update({
          where: { id: existing.id },
          data: { title: k[lang].title, content_text: k[lang].content, program_id },
        });
      } else {
        await db.knowledge_sources.create({
          data: {
            program_id,
            source_url: k.source_url,
            language_code: lang,
            title: k[lang].title,
            content_text: k[lang].content,
          },
        });
      }
    }
  }

  // ---- Community organizations (referral targets) -------------------------
  // Real national nonprofits, advocacy groups, and aid networks residents can
  // be referred to from the screening/results flow. `service_categories` align
  // with program categories (food, healthcare, cash, utilities, housing, tax,
  // education, childcare) plus a few cross-cutting needs (legal, immigration,
  // household, general) so the referral flow can match a resident's need to
  // relevant organizations.
  //
  // Idempotent by name: the table has no natural unique key, so we find-or-
  // update rather than upsert (mirrors the knowledge_sources approach above).
  const ORGANIZATIONS: {
    name: string;
    organization_type: string;
    phone?: string;
    website_url: string;
    service_categories: string[];
  }[] = [
    {
      name: "United Way (211 Helpline)",
      organization_type: "nonprofit",
      phone: "211",
      website_url: "https://www.211.org",
      service_categories: [
        "food",
        "housing",
        "utilities",
        "healthcare",
        "childcare",
        "general",
      ],
    },
    {
      name: "Feeding America",
      organization_type: "nonprofit",
      website_url: "https://www.feedingamerica.org",
      service_categories: ["food"],
    },
    {
      name: "Catholic Charities USA",
      organization_type: "faith-based",
      website_url: "https://www.catholiccharitiesusa.org",
      service_categories: ["food", "housing", "cash", "immigration"],
    },
    {
      name: "The Salvation Army",
      organization_type: "faith-based",
      website_url: "https://www.salvationarmyusa.org",
      service_categories: ["food", "housing", "utilities", "cash"],
    },
    {
      name: "Community Action Partnership",
      organization_type: "nonprofit",
      website_url: "https://communityactionpartnership.com",
      service_categories: ["utilities", "housing", "food", "education", "cash"],
    },
    {
      name: "National Council on Aging (BenefitsCheckUp)",
      organization_type: "nonprofit",
      website_url: "https://www.ncoa.org",
      service_categories: ["healthcare", "cash", "food"],
    },
    {
      name: "National Association of Free & Charitable Clinics",
      organization_type: "healthcare",
      website_url: "https://nafcclinics.org",
      service_categories: ["healthcare"],
    },
    {
      name: "Legal Services Corporation",
      organization_type: "legal aid",
      website_url: "https://www.lsc.gov",
      service_categories: ["legal"],
    },
    {
      name: "National Low Income Housing Coalition",
      organization_type: "advocacy",
      website_url: "https://nlihc.org",
      service_categories: ["housing"],
    },
    {
      name: "National Alliance to End Homelessness",
      organization_type: "advocacy",
      website_url: "https://endhomelessness.org",
      service_categories: ["housing"],
    },
    {
      name: "Child Care Aware of America",
      organization_type: "nonprofit",
      website_url: "https://www.childcareaware.org",
      service_categories: ["childcare"],
    },
    {
      name: "National Diaper Bank Network",
      organization_type: "nonprofit",
      website_url: "https://nationaldiaperbanknetwork.org",
      service_categories: ["childcare", "household"],
    },
    {
      name: "AARP Foundation Tax-Aide",
      organization_type: "nonprofit",
      website_url: "https://www.aarpfoundation.org",
      service_categories: ["tax"],
    },
    {
      name: "National Immigration Law Center",
      organization_type: "advocacy",
      website_url: "https://www.nilc.org",
      service_categories: ["immigration", "legal"],
    },
    {
      name: "National Head Start Association",
      organization_type: "nonprofit",
      website_url: "https://www.nhsa.org",
      service_categories: ["education", "childcare"],
    },
    {
      name: "National Energy Assistance Directors Association (LIHEAP)",
      organization_type: "nonprofit",
      website_url: "https://neada.org",
      service_categories: ["utilities"],
    },
  ];

  for (const o of ORGANIZATIONS) {
    const existing = await db.organizations.findFirst({
      where: { name: o.name },
      select: { id: true },
    });
    const data = {
      name: o.name,
      organization_type: o.organization_type,
      phone: o.phone ?? null,
      website_url: o.website_url,
      service_categories: o.service_categories,
    };
    if (existing) {
      await db.organizations.update({ where: { id: existing.id }, data });
    } else {
      await db.organizations.create({ data });
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
