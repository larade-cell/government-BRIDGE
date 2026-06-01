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
