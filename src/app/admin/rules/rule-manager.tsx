"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

export function RuleManager() {
  const programs = api.program.adminList.useQuery();
  const [programId, setProgramId] = useState<string>("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor="program" className="text-sm">
          Program
        </Label>
        <select
          id="program"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="h-8 min-w-64 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Select a program…</option>
          {(programs.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.latest_rule_version
                ? ` (v${p.latest_rule_version.version}${
                    p.latest_rule_version.is_published ? "" : " draft"
                  })`
                : " (no rules)"}
            </option>
          ))}
        </select>
      </div>

      {programId && <RuleVersions programId={programId} />}
    </div>
  );
}

function RuleVersions({ programId }: { programId: string }) {
  const utils = api.useUtils();
  const versions = api.eligibilityRule.listVersions.useQuery({
    program_id: programId,
  });

  const [draft, setDraft] = useState("");
  const [bias, setBias] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const create = api.eligibilityRule.createVersion.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.eligibilityRule.listVersions.invalidate({
        program_id: programId,
      });
      void utils.program.adminList.invalidate();
    },
  });
  const publish = api.eligibilityRule.publish.useMutation({
    onSuccess: () => {
      void utils.eligibilityRule.listVersions.invalidate({
        program_id: programId,
      });
      void utils.program.adminList.invalidate();
    },
  });

  function handleCreate() {
    setJsonError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setJsonError("Not valid JSON.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setJsonError("Rules must be a JSON object.");
      return;
    }
    create.mutate({
      program_id: programId,
      rules_json: parsed as Record<string, unknown>,
      false_positive_bias: bias,
    });
  }

  function prefillFrom(rules: unknown) {
    setDraft(JSON.stringify(rules, null, 2));
  }

  const list = versions.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* New version */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-5">
          <h3 className="text-sm font-semibold">New rule version</h3>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            spellCheck={false}
            placeholder='{ "requirements": [ { "key": "income", "condition": { "fact": "income_pct_fpl", "op": "lte", "value": 130 }, "label_en": "…", "label_es": "…" } ] }'
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bias}
                onChange={(e) => setBias(e.target.checked)}
              />
              False-positive bias (lean toward eligible)
            </label>
            <Button size="sm" onClick={handleCreate} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create draft"}
            </Button>
            {jsonError && (
              <span className="text-sm text-destructive">{jsonError}</span>
            )}
            {create.error && (
              <span className="text-sm text-destructive">
                {create.error.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Existing versions */}
      <div className="flex flex-col gap-2">
        {versions.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rule versions yet for this program.
          </p>
        ) : (
          list.map((v) => (
            <Card key={v.id}>
              <CardContent className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Version {v.version}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        v.is_published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {v.is_published ? "Published" : "Draft"}
                    </span>
                    {v.false_positive_bias && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        FP bias
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => prefillFrom(v.rules_json)}
                    >
                      Clone to editor
                    </Button>
                    {!v.is_published && (
                      <Button
                        size="xs"
                        disabled={publish.isPending}
                        onClick={() => publish.mutate({ id: v.id })}
                      >
                        Publish
                      </Button>
                    )}
                  </div>
                </div>
                <pre className="max-h-48 overflow-auto rounded-lg bg-muted/60 p-2 text-xs">
                  {JSON.stringify(v.rules_json, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
