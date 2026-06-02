"use client";

import { useState } from "react";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ConfirmButton } from "~/components/ui/confirm";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { api, type RouterOutputs } from "~/trpc/react";

type Source = RouterOutputs["knowledge"]["list"][number];

const textareaClass =
  "w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function KnowledgeManager() {
  const utils = api.useUtils();
  const list = api.knowledge.list.useQuery();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const remove = api.knowledge.delete.useMutation({
    onSuccess: () => void utils.knowledge.list.invalidate(),
  });

  const sources = list.data ?? [];

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
          {creating ? "Cancel" : "New source"}
        </Button>
      </div>

      {creating && (
        <SourceForm
          onDone={() => {
            setCreating(false);
            void utils.knowledge.list.invalidate();
          }}
        />
      )}

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No knowledge sources yet. Add one so the chatbot can answer from it.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <Card key={s.id} size="sm">
              <CardContent className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 uppercase">
                        {s.language_code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.embedded
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {s.embedded ? "Indexed" : "Not indexed"}
                      </span>
                    </div>
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-primary hover:underline"
                    >
                      {s.source_url}
                    </a>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        setEditingId((cur) => (cur === s.id ? null : s.id))
                      }
                    >
                      {editingId === s.id ? "Close" : "Edit"}
                    </Button>
                    <ConfirmButton
                      size="xs"
                      variant="destructive"
                      confirmVariant="destructive"
                      title="Remove this source?"
                      description={`"${s.title}" and its embedding will be removed; the chatbot will stop using it.`}
                      confirmLabel="Remove"
                      disabled={remove.isPending}
                      onConfirm={() => remove.mutateAsync({ id: s.id })}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                </div>
                {editingId === s.id && (
                  <SourceForm
                    source={s}
                    onDone={() => {
                      setEditingId(null);
                      void utils.knowledge.list.invalidate();
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceForm({
  source,
  onDone,
}: {
  source?: Source;
  onDone: () => void;
}) {
  const isEdit = Boolean(source);
  const programs = api.program.adminList.useQuery();
  const [title, setTitle] = useState(source?.title ?? "");
  const [url, setUrl] = useState(source?.source_url ?? "");
  const [language, setLanguage] = useState(source?.language_code ?? "en");
  const [content, setContent] = useState(source?.content_text ?? "");
  const [programId, setProgramId] = useState(source?.program_id ?? "");

  const create = api.knowledge.create.useMutation({ onSuccess: onDone });
  const update = api.knowledge.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  // Surfaced after a save that couldn't embed (AI disabled / no key).
  const result = create.data ?? update.data;

  function submit() {
    const common = {
      title: title.trim(),
      source_url: url.trim(),
      language_code: language,
      content_text: content.trim(),
      program_id: programId || null,
    };
    if (isEdit && source) {
      update.mutate({ id: source.id, ...common });
    } else {
      create.mutate(common);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Source URL (official page)">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.benefits.gov/…"
          />
        </Field>
        <Field label="Language">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={selectClass}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Field>
        <Field label="Related program (optional)">
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className={selectClass}
          >
            <option value="">None</option>
            {(programs.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Content (what the assistant answers from)">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className={textareaClass}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : isEdit ? "Save & re-embed" : "Create & embed"}
        </Button>
        {result && !result.embedded && (
          <span className="text-xs text-amber-600">
            Saved, but not indexed (AI is disabled). Run the embeddings backfill
            to make it searchable.
          </span>
        )}
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
