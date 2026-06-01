"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Brand } from "~/components/ui/brand";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api, type RouterOutputs } from "~/trpc/react";

type Question = RouterOutputs["question"]["list"][number];

export function Questionnaire({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const utils = api.useUtils();
  const { locale, t } = useI18n();

  const [questions] = api.question.list.useSuspenseQuery({
    language_code: locale,
  });
  const [session] = api.screeningSession.byId.useSuspenseQuery({ id: sessionId });

  // Build a map from question id → stored answer so we can pre-fill on resume.
  const storedAnswers = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const a of session.screening_answers) {
      map.set(a.question_id, a.answer_value);
    }
    return map;
  }, [session.screening_answers]);

  const [index, setIndex] = useState(0);
  const current = questions[index];
  const isLast = index === questions.length - 1;

  const upsert = api.answer.upsert.useMutation({
    onSuccess: () => utils.screeningSession.byId.invalidate({ id: sessionId }),
  });

  const [draft, setDraft] = useState<unknown>(
    current ? storedAnswers.get(current.id) ?? null : null,
  );
  const [error, setError] = useState<string | null>(null);

  // Reset draft when navigating to a new question.
  function goTo(nextIndex: number) {
    const next = questions[nextIndex];
    setDraft(next ? storedAnswers.get(next.id) ?? null : null);
    setError(null);
    setIndex(nextIndex);
  }

  async function handleNext() {
    if (!current) return;
    if (current.is_required && (draft === null || draft === "")) {
      // Surface a clear, friendly prompt rather than a silently-disabled button.
      setError(t.screening.validationRequired);
      return;
    }
    setError(null);

    await upsert.mutateAsync({
      session_id: sessionId,
      question_id: current.id,
      answer_value: draft,
    });

    if (isLast) {
      router.push(`/screening/${sessionId}/results`);
    } else {
      goTo(index + 1);
    }
  }

  if (!current) {
    return (
      <main className="brand-gradient flex min-h-screen items-center justify-center text-white">
        <p>{t.screening.noQuestions}</p>
      </main>
    );
  }

  const progress = ((index + 1) / questions.length) * 100;

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center px-4 py-8 text-white sm:py-12">
      <div className="mb-8 flex w-full max-w-xl items-center justify-between gap-3">
        <Brand href="/" />
        <LocaleToggle variant="dark" />
      </div>
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-white/70">
            <span>
              {fmt(t.screening.questionCounter, {
                n: index + 1,
                total: questions.length,
              })}
            </span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          {/* Smoothly-animating progress bar. */}
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Re-keyed by question id so each question animates in on navigation. */}
        <div
          key={current.id}
          className="rounded-2xl bg-white/10 p-6 shadow-xl ring-1 ring-white/10 duration-300 animate-in fade-in slide-in-from-right-4 sm:p-8"
        >
          <h2 className="mb-2 font-heading text-2xl font-semibold">
            {current.prompt}
          </h2>
          {current.helper_text && (
            <p className="mb-6 text-sm text-white/70">{current.helper_text}</p>
          )}

          <div className="mb-6">
            <QuestionInput
              question={current}
              value={draft}
              onChange={(v) => {
                setDraft(v);
                if (error) setError(null);
              }}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-400/15 px-3 py-2 text-sm text-red-200 ring-1 ring-red-400/20 duration-200 animate-in fade-in"
            >
              {error}
            </p>
          )}

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              {t.common.back}
            </Button>
            <Button onClick={handleNext} disabled={upsert.isPending}>
              {upsert.isPending ? (
                <>
                  <Spinner className="size-4" /> {t.common.saving}
                </>
              ) : isLast ? (
                t.screening.seeResults
              ) : (
                t.screening.next
              )}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Coerce a stored answer value to a text-input string (ignores non-scalars). */
function asText(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { t } = useI18n();
  switch (question.answer_type) {
    case "integer":
      return (
        <Input
          type="number"
          inputMode="numeric"
          step={1}
          value={asText(value)}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n);
          }}
          required={question.is_required}
        />
      );
    case "decimal":
      return (
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={asText(value)}
          onChange={(e) => {
            const n = e.target.value === "" ? null : Number(e.target.value);
            onChange(n);
          }}
          required={question.is_required}
        />
      );
    case "boolean":
      return (
        <RadioGroup
          value={value === true ? "yes" : value === false ? "no" : ""}
          onValueChange={(v) => onChange(v === "yes")}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem id={`${question.id}-yes`} value="yes" />
            <Label htmlFor={`${question.id}-yes`}>{t.screening.yes}</Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem id={`${question.id}-no`} value="no" />
            <Label htmlFor={`${question.id}-no`}>{t.screening.no}</Label>
          </div>
        </RadioGroup>
      );
    case "single_select":
      return (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          {question.options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-3">
              <RadioGroupItem id={opt.id} value={opt.option_key} />
              <Label htmlFor={opt.id}>{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    default:
      return (
        <Input
          type="text"
          value={asText(value)}
          onChange={(e) => onChange(e.target.value)}
          required={question.is_required}
        />
      );
  }
}
