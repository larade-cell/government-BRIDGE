"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { US_STATES } from "~/server/lib/eligibility/states";
import { api } from "~/trpc/react";

/** Loose view of the state-specific section of a rules_json blob. */
type StateCriterionView = { key?: string; label_en?: string };
type StateRulesView = {
  note?: string;
  override?: StateCriterionView[];
  add?: StateCriterionView[];
};

function readStates(rulesJson: unknown): Record<string, StateRulesView> {
  if (
    rulesJson &&
    typeof rulesJson === "object" &&
    "states" in rulesJson &&
    rulesJson.states &&
    typeof rulesJson.states === "object"
  ) {
    return rulesJson.states as Record<string, StateRulesView>;
  }
  return {};
}

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
                  }${
                    p.latest_rule_version.states.length > 0
                      ? `, ${p.latest_rule_version.states.length} state rules`
                      : ""
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

                <StateVariations rulesJson={v.rules_json} />

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

/** Renders the state-specific variations encoded in a version's rules_json. */
function StateVariations({ rulesJson }: { rulesJson: unknown }) {
  const states = readStates(rulesJson);
  const codes = Object.keys(states).sort();
  if (codes.length === 0) return null;

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
      <p className="text-sm font-semibold text-sky-900">
        State-specific variations ({codes.length})
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {codes.map((code) => {
          const sr = states[code]!;
          const changes = [
            ...(sr.override ?? []).map((c) => ({ kind: "override", c })),
            ...(sr.add ?? []).map((c) => ({ kind: "add", c })),
          ];
          return (
            <li key={code} className="rounded-md bg-background p-2 text-xs">
              <div className="font-medium">
                {code}
                <span className="text-muted-foreground">
                  {" "}
                  · {US_STATES[code] ?? code}
                </span>
              </div>
              {sr.note && <p className="mt-0.5 text-muted-foreground">{sr.note}</p>}
              {changes.length > 0 && (
                <ul className="mt-1 flex flex-col gap-0.5">
                  {changes.map((ch, i) => (
                    <li key={i}>
                      <span
                        className={`mr-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase ${
                          ch.kind === "override"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {ch.kind}
                      </span>
                      <span className="font-mono">{ch.c.key}</span>
                      {ch.c.label_en ? ` — ${ch.c.label_en}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
