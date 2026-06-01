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
import { Tooltip } from "~/components/ui/tooltip";
import { api } from "~/trpc/server";

import { EligibilityExplainer } from "./eligibility-explainer";
import { RequestHelp } from "./request-help";

const outcomeLabel: Record<string, { label: string; tone: string; help: string }> = {
  likely_eligible: {
    label: "Likely eligible",
    tone: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
    help: "Your answers meet this program's screening criteria. Final eligibility is confirmed when you apply.",
  },
  may_be_eligible: {
    label: "May be eligible",
    tone: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
    help: "You may qualify — some answers are borderline or missing. It's worth applying.",
  },
  needs_more_info: {
    label: "Needs more information",
    tone: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
    help: "We need a little more information to estimate eligibility for this program.",
  },
  unlikely_eligible: {
    label: "Unlikely eligible",
    tone: "bg-slate-500/20 text-slate-200 ring-slate-400/30",
    help: "Your answers suggest you probably don't meet this program's criteria right now.",
  },
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

  try {
    await api.screeningSession.byId({ id: sessionId });
  } catch {
    notFound();
  }

  // Run eligibility on visit. Idempotent — the upsert keys on (session, program).
  await api.eligibility.run({ session_id: sessionId });
  const results = await api.eligibilityResult.list({
    session_id: sessionId,
    language_code: "en",
  });

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center px-4 py-8 text-white sm:py-12">
      <div className="mb-8 w-full max-w-2xl">
        <Brand href="/" />
      </div>
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center duration-500 animate-in fade-in slide-in-from-bottom-3">
          <h1 className="mb-3 font-heading text-3xl font-bold sm:text-4xl">
            Your results
          </h1>
          <p className="text-white/70">
            Based on your answers, here are the programs you may qualify for.
            These are estimates only — final eligibility is determined by the
            agency that runs each program.
          </p>
        </div>

        {results.length === 0 ? (
          <p className="text-center text-white/70">
            No programs matched. Try adjusting your answers or browse all
            programs.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {results.map((r, i) => {
              const oc = outcomeLabel[r.outcome] ?? {
                label: r.outcome,
                tone: "bg-white/10 text-white",
                help: "",
              };
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
                      <Tooltip label={oc.help}>
                        <span
                          tabIndex={0}
                          className={`cursor-help whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 outline-none ${oc.tone}`}
                        >
                          {oc.label}
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
                        label={stateReason ?? "State-specific rules were applied."}
                        className="w-60"
                      >
                        <span
                          tabIndex={0}
                          className="inline-flex w-fit cursor-help items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-200 ring-1 ring-indigo-400/30 outline-none"
                        >
                          Adjusted for {exp.applied_state}
                        </span>
                      </Tooltip>
                    )}
                    {r.program.next_steps && (
                      <div>
                        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/60">
                          Next steps
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
                      Open the {r.program.name} application →
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
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
