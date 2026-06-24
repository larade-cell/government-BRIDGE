import Link from "next/link";

import { Brand } from "~/components/ui/brand";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GlobeIcon,
  ShieldIcon,
} from "~/components/ui/icons";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { getI18n } from "~/i18n/server";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

// Photography (Unsplash CDN, free license). Sized via query params so the
// browser only pulls what it needs; the navy overlays keep text AA-legible.
const img = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const HERO_IMG = img("photo-1429041966141-44d228a42775", 2000); // National Mall
const FEATURE_IMG = img("photo-1582213782179-e0d53f98f2ca", 1200); // hands together

// Squared, high-contrast government buttons (USWDS style) — no decorative pills.
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded bg-white px-6 py-3 text-base font-bold text-[#1a4480] shadow-sm transition hover:bg-white/90 active:translate-y-px";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded border-2 border-white/70 px-6 py-3 text-base font-bold text-white transition hover:bg-white/10 active:translate-y-px";

// Programs a single questionnaire screens for. Names are proper nouns, so they
// read the same in every locale; the section heading carries the language.
const PROGRAMS = [
  { name: "SNAP", tag: "Food assistance" },
  { name: "WIC", tag: "Women, Infants & Children" },
  { name: "Medicaid / CHIP", tag: "Health coverage" },
  { name: "LIHEAP", tag: "Utility & energy help" },
  { name: "Rental assistance", tag: "Housing" },
  { name: "Childcare subsidies", tag: "Childcare" },
];

export default async function Home() {
  const [session, { t }] = await Promise.all([auth(), getI18n()]);

  const categories = [
    {
      title: t.home.catFood,
      desc: t.home.catFoodDesc,
      img: img("photo-1593113598332-cd288d649433", 800), // food bank
    },
    {
      title: t.home.catHealth,
      desc: t.home.catHealthDesc,
      img: img("photo-1542884748-2b87b36c6b90", 800), // health screening
    },
    {
      title: t.home.catHousing,
      desc: t.home.catHousingDesc,
      img: img("photo-1605276374104-dee2a0ed3cd6", 800), // housing
    },
  ];

  const steps = [
    { title: t.home.step1Title, desc: t.home.step1Desc },
    { title: t.home.step2Title, desc: t.home.step2Desc },
    { title: t.home.step3Title, desc: t.home.step3Desc },
  ];

  return (
    <HydrateClient>
      <div className="bg-background text-foreground flex min-h-screen flex-col">
        {/* Hero: full-bleed photograph of the National Mall behind a federal
            navy wash, so the headline stays high-contrast and official. */}
        <header className="relative isolate overflow-hidden text-white">
          <div
            aria-hidden
            className="absolute inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url("${HERO_IMG}")` }}
          />
          {/* Two stacked overlays: a left-weighted gradient for text contrast,
              plus a bottom fade that blends into the page below. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0b1b32]/95 via-[#112e51]/85 to-[#1a4480]/45"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-[#0b1b32]"
          />

          <div className="page-container flex items-center justify-between gap-3 py-4">
            <Brand href="/" />
            <div className="flex items-center gap-3 text-sm">
              <LocaleToggle variant="dark" />
              {session?.user ? (
                <Link
                  href="/dashboard"
                  className="rounded border border-white/40 px-3 py-1.5 font-semibold transition hover:bg-white/10"
                >
                  {t.common.dashboard}
                </Link>
              ) : (
                <Link
                  href="/auth/magic-link"
                  className="rounded px-3 py-1.5 font-semibold text-white/90 underline-offset-4 transition hover:underline"
                >
                  {t.common.signIn}
                </Link>
              )}
            </div>
          </div>

          <div className="page-container pt-12 pb-20 sm:pt-20 sm:pb-28">
            <div className="max-w-3xl">
              <span className="inline-block border-l-4 border-[#ff5d6c] pl-3 text-sm font-semibold tracking-wide text-white/80 uppercase">
                {t.home.badge}
              </span>
              <h1 className="font-display mt-4 text-4xl font-black tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {t.home.title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-pretty text-white/90 sm:text-xl">
                {t.home.subtitle}
              </p>

              {session?.user && (
                <p className="mt-6 text-sm text-white/80">
                  {t.home.signedInAs}{" "}
                  <span className="font-semibold text-white">
                    {session.user.name ?? session.user.email}
                  </span>
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/screening/start" className={primaryBtn}>
                  {t.home.startScreening}
                  <ArrowRightIcon className="size-4" />
                </Link>
                {session?.user ? (
                  <>
                    <Link href="/dashboard" className={ghostBtn}>
                      {t.home.goToDashboard}
                    </Link>
                    <Link href="/api/auth/signout" className={ghostBtn}>
                      {t.common.signOut}
                    </Link>
                  </>
                ) : (
                  <Link href="/auth/magic-link" className={ghostBtn}>
                    {t.common.signIn}
                  </Link>
                )}
              </div>
              <p className="mt-4 text-sm text-white/75">
                {t.home.screenerNote}
              </p>

              {/* Trust signals — reassure before the first click. */}
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-white/90">
                <li className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4 text-white" />
                  {t.home.trustFree}
                </li>
                <li className="flex items-center gap-2">
                  <ShieldIcon className="size-4 text-white" />
                  {t.home.trustPrivate}
                </li>
                <li className="flex items-center gap-2">
                  <GlobeIcon className="size-4 text-white" />
                  {t.home.trustBilingual}
                </li>
              </ul>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1">
          {/* "How can we help you today?" — DMV-style task cards. */}
          <section
            aria-labelledby="help-heading"
            className="page-container py-12 sm:py-16"
          >
            <h2
              id="help-heading"
              className="font-display text-2xl font-bold sm:text-3xl"
            >
              {t.home.howCanWeHelp}
            </h2>
            <p className="text-muted-foreground mt-2">{t.home.helpLead}</p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TaskCard
                href="/screening/start"
                title={t.home.checkTitle}
                desc={t.home.checkDesc}
              />
              <TaskCard
                href={session?.user ? "/dashboard" : "/auth/magic-link"}
                title={t.home.continueTitle}
                desc={t.home.continueDesc}
              />
              <TaskCard
                href="/screening/start"
                title={t.home.helpTitle}
                desc={t.home.helpDesc}
              />
            </ul>
          </section>

          {/* Reassurance + how-it-works — photo paired with three numbered
              steps so the process feels approachable and finite. */}
          <section className="border-border bg-secondary border-y">
            <div className="page-container grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl shadow-md ring-1 ring-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={FEATURE_IMG}
                  alt=""
                  className="h-64 w-full object-cover sm:h-80 lg:h-96"
                  loading="lazy"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-[#0b1b32]/30 to-transparent"
                />
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">
                  {t.home.featureTitle}
                </h2>
                <p className="text-muted-foreground mt-3">
                  {t.home.featureLead}
                </p>
                <ol className="mt-8 flex flex-col gap-6">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="text-foreground font-semibold">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {step.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* Explore by category — photo cards as visual entry points. */}
          <section
            aria-labelledby="categories-heading"
            className="page-container py-12 sm:py-16"
          >
            <h2
              id="categories-heading"
              className="font-display text-2xl font-bold sm:text-3xl"
            >
              {t.home.categoriesTitle}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t.home.categoriesLead}
            </p>

            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((c) => (
                <li key={c.title}>
                  <Link
                    href="/screening/start"
                    className="group relative flex h-56 flex-col justify-end overflow-hidden rounded-xl text-white shadow-sm ring-1 ring-black/5 transition hover:shadow-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.img}
                      alt=""
                      className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-[#0b1b32]/90 via-[#0b1b32]/35 to-transparent"
                    />
                    <div className="relative p-5">
                      <h3 className="font-display text-xl font-bold">
                        {c.title}
                      </h3>
                      <p className="mt-1 text-sm text-white/85">{c.desc}</p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                        {t.home.startScreening}
                        <ArrowRightIcon className="size-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Programs we screen for — GOV.UK-style "popular" links. */}
          <section
            aria-labelledby="programs-heading"
            className="border-border bg-secondary border-y"
          >
            <div className="page-container py-12 sm:py-16">
              <h2
                id="programs-heading"
                className="font-display text-2xl font-bold sm:text-3xl"
              >
                {t.home.programsTitle}
              </h2>
              <p className="text-muted-foreground mt-2">
                {t.home.programsLead}
              </p>

              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PROGRAMS.map((p) => (
                  <li key={p.name}>
                    <Link
                      href="/screening/start"
                      className="group border-border bg-card hover:border-primary hover:bg-accent flex items-center justify-between gap-3 rounded border px-4 py-3 transition"
                    >
                      <span>
                        <span className="text-foreground block font-semibold">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {p.tag}
                        </span>
                      </span>
                      <ArrowRightIcon className="text-primary size-4 shrink-0 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </main>

        <footer className="border-border bg-background border-t">
          <div className="page-container text-muted-foreground flex flex-col items-start justify-between gap-4 py-8 text-sm sm:flex-row sm:items-center">
            <Brand />
            {!session?.user && (
              <Link
                href="/auth/magic-link?staff=1"
                className="prose-link inline-flex items-center gap-1.5 font-medium"
              >
                {t.home.staffSignIn}
                <ArrowRightIcon className="size-4" />
              </Link>
            )}
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
}

/** A single "how can we help" action card linking to a primary task. */
function TaskCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group border-border border-t-primary bg-card hover:border-primary flex h-full flex-col gap-2 rounded border border-t-4 p-5 shadow-sm transition hover:shadow-md"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-display text-foreground text-lg font-bold">
            {title}
          </span>
          <ArrowRightIcon className="text-primary size-5 shrink-0 transition group-hover:translate-x-0.5" />
        </span>
        <span className="text-muted-foreground">{desc}</span>
      </Link>
    </li>
  );
}
