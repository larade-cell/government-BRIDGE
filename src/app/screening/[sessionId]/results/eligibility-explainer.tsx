"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip } from "~/components/ui/tooltip";
import { useI18n } from "~/i18n/client";
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
}: {
  sessionId: string;
  programId: string;
}) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const explain = api.ai.explainEligibility.useQuery(
    {
      session_id: sessionId,
      program_id: programId,
      language_code: locale,
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
        {t.results.explainer.button}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-sky-200">
          {t.results.explainer.title}
        </h3>
        <Tooltip label={t.results.explainer.about}>
          <span
            tabIndex={0}
            aria-label={t.results.explainer.title}
            className="flex size-4 cursor-help items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            i
          </span>
        </Tooltip>
      </div>

      {explain.isLoading && (
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Spinner /> {t.results.explainer.loading}
        </div>
      )}

      {explain.isError && (
        <div className="flex flex-col items-start gap-2 text-sm text-white/75">
          <p>{t.results.explainer.errorBody}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void explain.refetch()}
          >
            {t.results.explainer.tryAgain}
          </Button>
        </div>
      )}

      {explain.data && (
        <div className="flex flex-col gap-3 text-sm text-white/85">
          <p>{explain.data.explanation}</p>

          {explain.data.key_factors.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/55">
                {t.results.explainer.whatMattered}
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
                {t.results.explainer.suggestedNextSteps}
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
              ? t.results.explainer.aiGenerated
              : t.results.explainer.standard}{" "}
            · {explain.data.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
