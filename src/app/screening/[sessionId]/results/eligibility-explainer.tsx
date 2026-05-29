"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip } from "~/components/ui/tooltip";
import { api } from "~/trpc/react";

/**
 * "AI Suggestions" panel for a single program result. The deterministic outcome
 * is already shown by the page; this explains it in plain language on demand.
 *
 * On demand (not on mount) so we don't fire a model call for every program when
 * the page loads. The server endpoint always returns a usable payload — if AI
 * is disabled or times out it returns a deterministic explanation
 * (`ai_generated: false`); if the request itself fails (e.g. rate limited) we
 * show a graceful fallback note with a retry.
 */
export function EligibilityExplainer({
  sessionId,
  programId,
  languageCode = "en",
}: {
  sessionId: string;
  programId: string;
  languageCode?: string;
}) {
  const [open, setOpen] = useState(false);
  const explain = api.ai.explainEligibility.useQuery(
    {
      session_id: sessionId,
      program_id: programId,
      language_code: languageCode,
    },
    {
      enabled: open,
      retry: false,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        ✨ Explain my result with AI
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-sky-200">AI suggestions</h3>
        <Tooltip label="This explanation is AI-generated from your screening result. It is general information, not an official eligibility decision.">
          <span
            tabIndex={0}
            aria-label="About AI suggestions"
            className="flex size-4 cursor-help items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            i
          </span>
        </Tooltip>
      </div>

      {explain.isLoading && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Spinner /> Generating a plain-language explanation…
        </div>
      )}

      {explain.isError && (
        <div className="flex flex-col items-start gap-2 text-sm text-white/75">
          <p>
            We couldn’t generate an AI explanation right now. Your results above
            are still accurate.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void explain.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {explain.data && (
        <div className="flex flex-col gap-3 text-sm text-white/85">
          <p>{explain.data.explanation}</p>

          {explain.data.key_factors.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/55">
                What mattered
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-white/80">
                {explain.data.key_factors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {explain.data.next_steps.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/55">
                Suggested next steps
              </h4>
              <ul className="list-disc space-y-1 pl-5 text-white/80">
                {explain.data.next_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-white/45">
            {explain.data.ai_generated
              ? "AI-generated"
              : "Standard explanation"}{" "}
            · {explain.data.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
