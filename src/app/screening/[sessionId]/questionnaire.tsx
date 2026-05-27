"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { api, type RouterOutputs } from "~/trpc/react";

type Question = RouterOutputs["question"]["list"][number];

export function Questionnaire({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const utils = api.useUtils();

  const [questions] = api.question.list.useSuspenseQuery({ language_code: "en" });
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

  // Reset draft when navigating to a new question.
  function goTo(nextIndex: number) {
    const next = questions[nextIndex];
    setDraft(next ? storedAnswers.get(next.id) ?? null : null);
    setIndex(nextIndex);
  }

  async function handleNext() {
    if (!current) return;
    if (current.is_required && (draft === null || draft === "")) {
      // Browser-level required validation lives on the inputs below; this is
      // a safety net for the boolean/radio case where there's no native
      // requiredness.
      return;
    }

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
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#020617] text-white">
        <p>No questions configured.</p>
      </main>
    );
  }

  const progress = ((index + 1) / questions.length) * 100;

  return (
    <main className="flex min-h-screen flex-col items-center bg-gradient-to-b from-[#0f172a] to-[#020617] px-4 py-12 text-white">
      <div className="w-full max-w-xl">
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-white/70">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="bg-white/20" />
        </div>

        <div className="rounded-xl bg-white/10 p-8">
          <h2 className="mb-2 text-2xl font-semibold">{current.prompt}</h2>
          {current.helper_text && (
            <p className="mb-6 text-sm text-white/70">{current.helper_text}</p>
          )}

          <div className="mb-8">
            <QuestionInput
              question={current}
              value={draft}
              onChange={setDraft}
            />
          </div>

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => goTo(Math.max(0, index - 1))}
              disabled={index === 0}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={
                upsert.isPending ||
                (current.is_required && (draft === null || draft === ""))
              }
            >
              {upsert.isPending ? "Saving..." : isLast ? "See results" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </main>
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
  switch (question.answer_type) {
    case "integer":
      return (
        <Input
          type="number"
          inputMode="numeric"
          step={1}
          value={value == null ? "" : String(value)}
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
          value={value == null ? "" : String(value)}
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
            <Label htmlFor={`${question.id}-yes`}>Yes</Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem id={`${question.id}-no`} value="no" />
            <Label htmlFor={`${question.id}-no`}>No</Label>
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
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          required={question.is_required}
        />
      );
  }
}
