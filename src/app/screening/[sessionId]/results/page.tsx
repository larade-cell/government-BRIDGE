import Link from "next/link";
import { notFound } from "next/navigation";

import { Brand } from "~/components/ui/brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { Tooltip } from "~/components/ui/tooltip";
import { fmt } from "~/i18n/config";
import { getI18n } from "~/i18n/server";
import { api } from "~/trpc/server";

import { EligibilityExplainer } from "./eligibility-explainer";
import { RequestHelp } from "./request-help";

// Color only — labels/help come from the locale catalog.
const outcomeTone: Record<string, string> = {
  likely_eligible: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
  may_be_eligible: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  needs_more_info: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
  unlikely_eligible: "bg-slate-500/20 text-slate-200 ring-slate-400/30",
};

type ResultExplanation = {
  applied_state?: string | null;
  reasons?: string[];
} | null;

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { locale, t } = await getI18n();

  try {
    await api.screeningSession.byId({ id: sessionId });
  } catch {
    notFound();
  }

  // Run eligibility on visit. Idempotent — the upsert keys on (session, program).
  await api.eligibility.run({ session_id: sessionId });
  const results = await api.eligibilityResult.list({
    session_id: sessionId,
    language_code: locale,
  });

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center px-4 py-8 text-white sm:py-12">
      <div className="mb-8 flex w-full max-w-2xl items-center justify-between gap-3">
        <Brand href="/" />
        <LocaleToggle variant="dark" />
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center duration-500 animate-in fade-in slide-in-from-bottom-3">
          <h1 className="mb-3 font-heading text-3xl font-bold sm:text-4xl">
            {t.results.title}
          </h1>
          <p className="text-white/70">{t.results.subtitle}</p>
        </div>

        {results.length === 0 ? (
          <p className="text-center text-white/70">{t.results.noMatch}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {results.map((r, i) => {
              const oc = t.results.outcomes[r.outcome];
              const label = oc.label;
              const help = oc.help;
              const tone = outcomeTone[r.outcome] ?? "bg-white/10 text-white";
              const exp = r.explanation as ResultExplanation;
              const stateReason = exp?.reasons?.find((reason) =>
                reason.startsWith("Adjusted for your state"),
              );
              return (
                <Card
                  key={r.id}
                  style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                  className="border-white/10 bg-white/10 text-white duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-2xl">
                        {r.program.name}
                      </CardTitle>
                      <Tooltip label={help}>
                        <span
                          tabIndex={0}
                          className={`cursor-help whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 outline-none ${tone}`}
                        >
                          {label}
                        </span>
                      </Tooltip>
                    </div>
                    {r.program.short_description && (
                      <CardDescription className="text-white/70">
                        {r.program.short_description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {exp?.applied_state && (
                      <Tooltip
                        label={stateReason ?? t.results.adjustedFallback}
                        className="w-60"
                      >
                        <span
                          tabIndex={0}
                          className="inline-flex w-fit cursor-help items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-200 ring-1 ring-indigo-400/30 outline-none"
                        >
                          {fmt(t.results.adjustedFor, { state: exp.applied_state })}
                        </span>
                      </Tooltip>
                    )}
                    {r.program.next_steps && (
                      <div>
                        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/60">
                          {t.results.nextSteps}
                        </h3>
                        <p className="text-sm text-white/85">
                          {r.program.next_steps}
                        </p>
                      </div>
                    )}
                    <Link
                      href={r.program.authoritative_url}
                      target="_blank"
                      className="text-sm font-semibold text-sky-300 hover:underline"
                    >
                      {fmt(t.results.openApplication, { program: r.program.name })}
                    </Link>
                    <EligibilityExplainer
                      sessionId={sessionId}
                      programId={r.program.id}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-8">
            <RequestHelp sessionId={sessionId} />
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="rounded-full bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
          >
            {t.results.backHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
