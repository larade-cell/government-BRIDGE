import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/server";

import { EligibilityExplainer } from "./eligibility-explainer";
import { RequestHelp } from "./request-help";

const outcomeLabel: Record<string, { label: string; tone: string }> = {
  likely_eligible: {
    label: "Likely eligible",
    tone: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
  },
  may_be_eligible: {
    label: "May be eligible",
    tone: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  },
  needs_more_info: {
    label: "Needs more information",
    tone: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
  },
  unlikely_eligible: {
    label: "Unlikely eligible",
    tone: "bg-slate-500/20 text-slate-200 ring-slate-400/30",
  },
};

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
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0f172a] to-[#020617] px-4 py-12 text-white">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-4xl font-bold">Your results</h1>
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
            {results.map((r) => {
              const oc = outcomeLabel[r.outcome] ?? {
                label: r.outcome,
                tone: "bg-white/10 text-white",
              };
              return (
                <Card
                  key={r.id}
                  className="border-white/10 bg-white/10 text-white"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-2xl">
                        {r.program.name}
                      </CardTitle>
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${oc.tone}`}
                      >
                        {oc.label}
                      </span>
                    </div>
                    {r.program.short_description && (
                      <CardDescription className="text-white/70">
                        {r.program.short_description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
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
