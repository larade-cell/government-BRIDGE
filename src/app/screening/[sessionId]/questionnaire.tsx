"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Brand } from "~/components/ui/brand";
import { Button } from "~/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  WarningIcon,
} from "~/components/ui/icons";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api, type RouterOutputs } from "~/trpc/react";

type Question = RouterOutputs["question"]["list"][number];

// Large, high-contrast field styling for the questionnaire's dark backdrop —
// tall enough to be an easy target and legible for low-vision users.
const questionInputClass =
  "h-12 border-white/40 text-lg text-white placeholder:text-white/50";

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

  // Resume where they left off: jump to the first unanswered question (or the
  // last question if everything's answered), instead of restarting at 0.
  const resumeIndex = useMemo(() => {
    const firstUnanswered = questions.findIndex((q) => !storedAnswers.has(q.id));
    return firstUnanswered === -1
      ? Math.max(0, questions.length - 1)
      : firstUnanswered;
  }, [questions, storedAnswers]);

  const [index, setIndex] = useState(resumeIndex);
  const current = questions[index];
  const isLast = index === questions.length - 1;

  const upsert = api.answer.upsert.useMutation({
    onSuccess: () => utils.screeningSession.byId.invalidate({ id: sessionId }),
  });
  const complete = api.screeningSession.complete.useMutation();

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
      // Mark the session complete so it counts in reports and shows as
      // "Completed" on the resident's dashboard.
      await complete.mutateAsync({ session_id: sessionId });
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
    <main
      id="main-content"
      className="brand-gradient flex min-h-screen flex-col items-center px-4 py-8 text-white sm:py-12"
    >
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
          <h2 className="mb-2 font-heading text-2xl font-bold sm:text-3xl">
            {current.prompt}
          </h2>
          {current.helper_text && (
            <p className="mb-6 text-base text-white/80">{current.helper_text}</p>
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
              className="mb-4 flex items-center gap-2 rounded-md bg-red-400/15 px-3 py-2.5 text-sm font-medium text-red-100 ring-1 ring-red-400/30 duration-200 animate-in fade-in"
            >
              <WarningIcon className="size-5 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
              className="gap-2 text-white hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <ArrowLeftIcon className="size-5" />
              {t.common.back}
            </Button>
            <Button
              onClick={handleNext}
              size="lg"
              disabled={upsert.isPending || complete.isPending}
              className="!bg-white px-7 font-bold !text-[#1a4480] hover:!bg-white/90"
            >
              {upsert.isPending || complete.isPending ? (
                <>
                  <Spinner className="size-4" /> {t.common.saving}
                </>
              ) : isLast ? (
                <>
                  {t.screening.seeResults}
                  <ArrowRightIcon className="size-5" />
                </>
              ) : (
                <>
                  {t.screening.next}
                  <ArrowRightIcon className="size-5" />
                </>
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

/**
 * A large, fully-clickable answer option. The whole card is the label, so the
 * tap target is big and forgiving — important for older users and anyone on a
 * phone. Selecting it fills the card and shows a check, a clearer signal than a
 * small radio dot alone. Keyboard + screen-reader behavior comes from the
 * underlying radio primitive.
 */
function OptionCard({
  id,
  value,
  label,
}: {
  id: string;
  value: string;
  label: string;
}) {
  return (
    <Label
      htmlFor={id}
      className="group cursor-pointer items-center gap-3 rounded-md border-2 border-white/30 bg-white/5 px-4 py-3.5 text-base font-medium text-white transition-colors hover:border-white/60 hover:bg-white/10 has-data-checked:border-white has-data-checked:bg-white has-data-checked:text-[#1a4480]"
    >
      <RadioGroupItem
        id={id}
        value={value}
        className="!size-5 !border-white/60 data-checked:!border-[#1a4480] data-checked:!bg-[#1a4480]"
      />
      <span className="flex-1">{label}</span>
      <CheckIcon className="size-5 opacity-0 transition-opacity peer-data-checked:opacity-100" />
    </Label>
  );
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
          className={questionInputClass}
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
          className={questionInputClass}
        />
      );
    case "boolean":
      return (
        <RadioGroup
          value={value === true ? "yes" : value === false ? "no" : ""}
          onValueChange={(v) => onChange(v === "yes")}
        >
          <OptionCard
            id={`${question.id}-yes`}
            value="yes"
            label={t.screening.yes}
          />
          <OptionCard
            id={`${question.id}-no`}
            value="no"
            label={t.screening.no}
          />
        </RadioGroup>
      );
    case "single_select":
      return (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          {question.options.map((opt) => (
            <OptionCard
              key={opt.id}
              id={opt.id}
              value={opt.option_key}
              label={opt.label}
            />
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
          className={questionInputClass}
        />
      );
  }
}
