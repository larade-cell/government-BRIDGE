"use client";

import Link from "next/link";
import { useState } from "react";

import { ChevronRightIcon, ExternalLinkIcon } from "~/components/ui/icons";
import { Tooltip } from "~/components/ui/tooltip";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { type RouterOutputs } from "~/trpc/react";

import { EligibilityExplainer } from "./eligibility-explainer";

type Result = RouterOutputs["eligibilityResult"]["list"][number];

// Color only — labels/help come from the locale catalog.
const outcomeTone: Record<string, string> = {
  likely_eligible: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30",
  may_be_eligible: "bg-sky-500/20 text-sky-200 ring-sky-400/30",
  needs_more_info: "bg-amber-500/20 text-amber-200 ring-amber-400/30",
  unlikely_eligible: "bg-slate-500/20 text-slate-200 ring-slate-400/30",
};

// The eligibility outcomes collapse into the three tabs the user navigates by:
// "needs more info" is borderline, so it sits with "may be eligible".
type Tier = "likely" | "maybe" | "unlikely";
const TIER_OF: Record<string, Tier> = {
  likely_eligible: "likely",
  may_be_eligible: "maybe",
  needs_more_info: "maybe",
  unlikely_eligible: "unlikely",
};
const TIER_ORDER: Tier[] = ["likely", "maybe", "unlikely"];

type ResultExplanation = {
  applied_state?: string | null;
  reasons?: string[];
} | null;

export function ResultsList({
  sessionId,
  results,
}: {
  sessionId: string;
  results: Result[];
}) {
  const { t } = useI18n();
  // null = follow the data (first non-empty tab); set once the user clicks.
  const [activeTab, setActiveTab] = useState<Tier | null>(null);

  const byTier: Record<Tier, Result[]> = {
    likely: [],
    maybe: [],
    unlikely: [],
  };
  for (const r of results) {
    byTier[TIER_OF[r.outcome] ?? "maybe"].push(r);
  }

  // Default to the first tab that actually has programs.
  const firstNonEmpty =
    TIER_ORDER.find((tier) => byTier[tier].length > 0) ?? "likely";
  const effectiveTab = activeTab ?? firstNonEmpty;

  const tierLabels: Record<Tier, string> = {
    likely: t.results.tabLikely,
    maybe: t.results.tabMaybe,
    unlikely: t.results.tabUnlikely,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Eligibility tabs — keeps the list short so the user lands on the
          programs they most likely qualify for without scrolling. */}
      <div
        role="tablist"
        className="flex flex-wrap gap-1 rounded-xl bg-white/10 p-1"
      >
        {TIER_ORDER.map((tier) => {
          const count = byTier[tier].length;
          const isActive = effectiveTab === tier;
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              id={`results-tab-${tier}`}
              aria-selected={isActive}
              aria-controls="results-panel"
              onClick={() => setActiveTab(tier)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                isActive
                  ? "bg-white text-[#1a4480] shadow-sm"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {tierLabels[tier]} ({count})
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="results-panel"
        aria-labelledby={`results-tab-${effectiveTab}`}
        className="flex flex-col gap-4"
      >
        {byTier[effectiveTab].length === 0 ? (
          <p className="rounded-xl border border-white/15 bg-white/5 px-4 py-6 text-center text-white/70">
            {t.results.tabEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {byTier[effectiveTab].map((r, i) => {
              const oc = t.results.outcomes[r.outcome];
              const label = oc.label;
              const help = oc.help;
              const tone = outcomeTone[r.outcome] ?? "bg-white/10 text-white";
              const exp = r.explanation as ResultExplanation;
              const stateReason = exp?.reasons?.find((reason) =>
                reason.startsWith("Adjusted for your state"),
              );
              return (
                // Collapsed by default — the summary alone keeps each program to a
                // single row so the whole list fits without scrolling; details
                // expand in place on click.
                <li key={r.id}>
                  <details
                    style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                    className="group animate-in fade-in slide-in-from-bottom-4 fill-mode-both rounded-xl border border-white/10 bg-white/10 text-white duration-500"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronRightIcon className="size-5 shrink-0 text-white/60 transition-transform group-open:rotate-90" />
                        <span className="truncate text-lg font-semibold">
                          {r.program.name}
                        </span>
                      </span>
                      <Tooltip label={help}>
                        <span
                          tabIndex={0}
                          className={`cursor-help rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ring-1 ${tone}`}
                        >
                          {label}
                        </span>
                      </Tooltip>
                    </summary>
                    <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3">
                      {r.program.short_description && (
                        <p className="text-sm text-white/70">
                          {r.program.short_description}
                        </p>
                      )}
                      {exp?.applied_state && (
                        <Tooltip
                          label={stateReason ?? t.results.adjustedFallback}
                          className="w-60"
                        >
                          <span
                            tabIndex={0}
                            className="inline-flex w-fit cursor-help items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/85 ring-1 ring-white/20"
                          >
                            {fmt(t.results.adjustedFor, {
                              state: exp.applied_state,
                            })}
                          </span>
                        </Tooltip>
                      )}
                      {r.program.next_steps && (
                        <div>
                          <h3 className="mb-1 text-sm font-semibold tracking-wide text-white/60 uppercase">
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
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-[#1a4480] transition hover:bg-white/90"
                      >
                        {fmt(t.results.openApplication, {
                          program: r.program.name,
                        })}
                        <span className="sr-only">{t.results.opensNewTab}</span>
                        <ExternalLinkIcon className="size-4" />
                      </Link>
                      <EligibilityExplainer
                        sessionId={sessionId}
                        programId={r.program.id}
                      />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
