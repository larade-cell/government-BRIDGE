"use client";

import { useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, type RouterOutputs } from "~/trpc/react";

const ANSWER_TYPES = ["integer", "decimal", "boolean", "single_select", "text"];
const textareaClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CatalogManager() {
  const [tab, setTab] = useState<"programs" | "questions">("programs");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "programs" ? "default" : "outline"}
          onClick={() => setTab("programs")}
        >
          Programs
        </Button>
        <Button
          size="sm"
          variant={tab === "questions" ? "default" : "outline"}
          onClick={() => setTab("questions")}
        >
          Questions
        </Button>
      </div>
      {tab === "programs" ? <ProgramsPanel /> : <QuestionsPanel />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Programs                                                                   */
/* -------------------------------------------------------------------------- */

function ProgramsPanel() {
  const utils = api.useUtils();
  const programs = api.program.adminList.useQuery();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const setActive = api.program.setActive.useMutation({
    onSuccess: () => void utils.program.adminList.invalidate(),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
        >
          {creating ? "Cancel" : "New program"}
        </Button>
      </div>

      {creating && (
        <ProgramForm
          onDone={() => {
            setCreating(false);
            void utils.program.adminList.invalidate();
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {(programs.data ?? []).map((p) => (
          <Card key={p.id} size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {p.category}
                  </span>
                  {!p.is_active && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      inactive
                    </span>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {p.program_key}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.is_active ? (
                    <ConfirmButton
                      size="xs"
                      variant="outline"
                      confirmVariant="destructive"
                      title="Deactivate this program?"
                      description={`"${p.name}" will stop appearing in new screenings until you reactivate it.`}
                      confirmLabel="Deactivate"
                      onConfirm={() =>
                        setActive.mutateAsync({ id: p.id, is_active: false })
                      }
                    >
                      Deactivate
                    </ConfirmButton>
                  ) : (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setActive.mutate({ id: p.id, is_active: true })
                      }
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setEditingId((cur) => (cur === p.id ? null : p.id))
                    }
                  >
                    {editingId === p.id ? "Close" : "Edit"}
                  </Button>
                </div>
              </div>
              {editingId === p.id && (
                <ProgramForm
                  programId={p.id}
                  onDone={() => {
                    setEditingId(null);
                    void utils.program.adminList.invalidate();
                  }}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProgramForm({
  programId,
  onDone,
}: {
  programId?: string;
  onDone: () => void;
}) {
  const isEdit = Boolean(programId);
  const existing = api.program.byId.useQuery(
    { id: programId!, language_code: "en" },
    { enabled: isEdit },
  );

  const [key, setKey] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Prefill once when editing.
  if (isEdit && existing.data && !hydrated) {
    setCategory(existing.data.category);
    setUrl(existing.data.authoritative_url);
    setName(existing.data.name);
    setDesc(existing.data.short_description ?? "");
    setSteps(existing.data.next_steps ?? "");
    setHydrated(true);
  }

  const create = api.program.create.useMutation({ onSuccess: onDone });
  const update = api.program.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function submit() {
    const translations = {
      en: {
        name: name.trim(),
        short_description: desc.trim(),
        next_steps: steps.trim(),
      },
    };
    if (isEdit) {
      update.mutate({
        id: programId!,
        category: category.trim(),
        authoritative_url: url.trim(),
        translations,
      });
    } else {
      create.mutate({
        program_key: key.trim(),
        category: category.trim(),
        authoritative_url: url.trim(),
        translations,
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      {!isEdit && (
        <Field label="Program key (e.g. snap)">
          <Input value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="food, healthcare, cash…"
          />
        </Field>
        <Field label="Authoritative URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      </div>
      <Field label="Name (English)">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Short description (English)">
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </Field>
      <Field label="Next steps (English)">
        <textarea
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </Field>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create program"}
        </Button>
        {error && (
          <Alert variant="error" className="flex-1">
            {error.message}
          </Alert>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                  */
/* -------------------------------------------------------------------------- */

type QuestionRow = RouterOutputs["question"]["list"][number];

function QuestionsPanel() {
  const utils = api.useUtils();
  const questions = api.question.list.useQuery({ language_code: "en" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const remove = api.question.delete.useMutation({
    onSuccess: () => void utils.question.list.invalidate(),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
        >
          {creating ? "Cancel" : "New question"}
        </Button>
      </div>

      {creating && (
        <QuestionForm
          onDone={() => {
            setCreating(false);
            void utils.question.list.invalidate();
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {(questions.data ?? []).map((q) => (
          <Card key={q.id} size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="mr-2 text-xs text-muted-foreground">
                    #{q.display_order}
                  </span>
                  <span className="font-medium">{q.prompt}</span>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {q.question_key} · {q.answer_type}
                    {q.is_required ? " · required" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      setEditingId((cur) => (cur === q.id ? null : q.id))
                    }
                  >
                    {editingId === q.id ? "Close" : "Edit"}
                  </Button>
                  <ConfirmButton
                    size="xs"
                    variant="destructive"
                    confirmVariant="destructive"
                    title="Remove this question?"
                    description={`"${q.prompt}" will be removed from the screener. Residents' existing answers to it are also deleted. Eligibility rules that read this answer will fall back to "needs more info".`}
                    confirmLabel="Remove"
                    disabled={remove.isPending}
                    onConfirm={() => remove.mutateAsync({ id: q.id })}
                  >
                    Remove
                  </ConfirmButton>
                </div>
              </div>
              {editingId === q.id && (
                <QuestionForm
                  question={q}
                  onDone={() => {
                    setEditingId(null);
                    void utils.question.list.invalidate();
                  }}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

type OptionDraft = { option_key: string; en: string; es: string };

function QuestionForm({
  question,
  onDone,
}: {
  question?: QuestionRow;
  onDone: () => void;
}) {
  const isEdit = Boolean(question);
  const [key, setKey] = useState(question?.question_key ?? "");
  const [answerType, setAnswerType] = useState(question?.answer_type ?? "integer");
  const [order, setOrder] = useState(String(question?.display_order ?? 0));
  const [required, setRequired] = useState(question?.is_required ?? true);
  const [promptEn, setPromptEn] = useState(question?.prompt ?? "");
  const [helperEn, setHelperEn] = useState(question?.helper_text ?? "");
  const [promptEs, setPromptEs] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>(
    question?.options.map((o) => ({
      option_key: o.option_key,
      en: o.label,
      es: "",
    })) ?? [],
  );

  const create = api.question.create.useMutation({ onSuccess: onDone });
  const update = api.question.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function submit() {
    const prompts = {
      en: {
        prompt: promptEn.trim(),
        helper_text: helperEn.trim() === "" ? null : helperEn.trim(),
      },
      ...(promptEs.trim() !== "" && { es: { prompt: promptEs.trim() } }),
    };
    const optionPayload =
      answerType === "single_select"
        ? options
            .filter((o) => o.option_key.trim() !== "")
            .map((o) => ({
              option_key: o.option_key.trim(),
              en: o.en.trim(),
              es: o.es.trim() || o.en.trim(),
            }))
        : undefined;

    if (isEdit && question) {
      update.mutate({
        id: question.id,
        answer_type: answerType as never,
        display_order: Number(order),
        is_required: required,
        prompts,
        ...(optionPayload ? { options: optionPayload } : {}),
      });
    } else {
      create.mutate({
        question_key: key.trim(),
        answer_type: answerType as never,
        display_order: Number(order),
        is_required: required,
        prompts,
        ...(optionPayload ? { options: optionPayload } : {}),
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {!isEdit && (
          <Field label="Question key">
            <Input value={key} onChange={(e) => setKey(e.target.value)} />
          </Field>
        )}
        <Field label="Answer type">
          <select
            value={answerType}
            onChange={(e) => setAnswerType(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {ANSWER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Display order">
          <Input
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </Field>
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Required
        </label>
      </div>

      <Field label="Prompt (English)">
        <Input value={promptEn} onChange={(e) => setPromptEn(e.target.value)} />
      </Field>
      <Field label="Helper text (English, optional)">
        <Input value={helperEn} onChange={(e) => setHelperEn(e.target.value)} />
      </Field>
      <Field label="Prompt (Spanish, optional)">
        <Input value={promptEs} onChange={(e) => setPromptEs(e.target.value)} />
      </Field>

      {answerType === "single_select" && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm">Options</Label>
          {options.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              <Input
                placeholder="key"
                value={o.option_key}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, option_key: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                placeholder="label (EN)"
                value={o.en}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, en: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                placeholder="label (ES)"
                value={o.es}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, es: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() =>
                  setOptions((prev) => prev.filter((_, j) => j !== i))
                }
              >
                ✕
              </Button>
            </div>
          ))}
          <div>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setOptions((prev) => [
                  ...prev,
                  { option_key: "", en: "", es: "" },
                ])
              }
            >
              Add option
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save changes" : "Create question"}
        </Button>
        {error && (
          <Alert variant="error" className="flex-1">
            {error.message}
          </Alert>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
