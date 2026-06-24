"use client";

import { Button } from "~/components/ui/button";
import { XIcon } from "~/components/ui/icons";
import { Label } from "~/components/ui/label";
import {
  FACT_BY_NAME,
  FACT_CATALOG,
  operatorsForType,
  type OperatorName,
} from "~/server/lib/eligibility/factCatalog";

import {
  newLeaf,
  newRequirement,
  type CondNode,
  type FormCriterion,
  type RuleForm,
} from "./rule-form";

const ctrl =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const smallBtn =
  "rounded border border-input bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted";

/**
 * Guided, plain-language editor for a program's eligibility rules. Admins build
 * requirements and conditions from dropdowns; the parent serializes the result
 * to the engine JSON (see rule-form.ts). No JSON typing required.
 */
export function NaturalRuleEditor({
  form,
  onChange,
}: {
  form: RuleForm;
  onChange: (f: RuleForm) => void;
}) {
  const setReq = (i: number, c: FormCriterion) =>
    onChange({
      ...form,
      requirements: form.requirements.map((r, j) => (j === i ? c : r)),
    });

  return (
    <div className="flex flex-col gap-4">
      <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
        Summary (maintainer note — optional)
        <textarea
          value={form.summary}
          onChange={(e) => onChange({ ...form, summary: e.target.value })}
          rows={2}
          className="border-input text-foreground focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
        />
      </label>

      <div className="flex flex-col gap-3">
        <Label className="text-sm">Requirements</Label>
        {form.requirements.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No requirements yet — a program with none screens as “needs more
            information”.
          </p>
        )}
        {form.requirements.map((r, i) => (
          <RequirementEditor
            key={i}
            value={r}
            index={i}
            onChange={(c) => setReq(i, c)}
            onRemove={() =>
              onChange({
                ...form,
                requirements: form.requirements.filter((_, j) => j !== i),
              })
            }
          />
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange({
              ...form,
              requirements: [...form.requirements, newRequirement()],
            })
          }
          className="self-start"
        >
          + Add requirement
        </Button>
      </div>
    </div>
  );
}

function RequirementEditor({
  value,
  index,
  onChange,
  onRemove,
}: {
  value: FormCriterion;
  index: number;
  onChange: (c: FormCriterion) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<FormCriterion>) =>
    onChange({ ...value, ...patch });
  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Requirement {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove requirement ${index + 1}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
          Key (short id, unique in this program)
          <input
            value={value.key}
            onChange={(e) => set({ key: e.target.value })}
            placeholder="e.g. income"
            className={ctrl}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-1 text-sm">
          <input
            type="checkbox"
            checked={value.hard}
            onChange={(e) => set({ hard: e.target.checked })}
          />
          Hard requirement (a failure rules the program out)
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
          Label — English (state it positively)
          <input
            value={value.label_en}
            onChange={(e) => set({ label_en: e.target.value })}
            placeholder="e.g. Household income within the limit"
            className={ctrl}
          />
        </label>
        <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
          Label — Spanish
          <input
            value={value.label_es}
            onChange={(e) => set({ label_es: e.target.value })}
            className={ctrl}
          />
        </label>
      </div>

      <label className="text-muted-foreground flex flex-col gap-1 text-xs font-medium">
        If not met, say (optional, English)
        <input
          value={value.unmet_en}
          onChange={(e) => set({ unmet_en: e.target.value })}
          placeholder="e.g. Your income may be above this program's limit"
          className={ctrl}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          Condition — when is this requirement met?
        </span>
        <ConditionEditor
          node={value.condition}
          onChange={(c) => set({ condition: c })}
          depth={0}
        />
      </div>
    </div>
  );
}

function ConditionEditor({
  node,
  onChange,
  onRemove,
  depth,
}: {
  node: CondNode;
  onChange: (n: CondNode) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const negated = node.t === "not";
  const inner = negated ? node.child : node;
  const setInner = (n: CondNode) =>
    onChange(negated ? { t: "not", child: n } : n);
  const notToggle = (
    <label className="text-muted-foreground flex items-center gap-1 text-xs">
      <input
        type="checkbox"
        checked={negated}
        onChange={(e) =>
          onChange(e.target.checked ? { t: "not", child: inner } : inner)
        }
      />
      NOT
    </label>
  );

  if (inner.t === "leaf") {
    const leaf = inner;
    const type = FACT_BY_NAME[leaf.fact]?.type ?? "string";
    const ops = operatorsForType(type);
    return (
      <div className="border-border bg-background flex flex-wrap items-center gap-2 rounded-md border p-2">
        {notToggle}
        <select
          aria-label="Fact"
          value={leaf.fact}
          onChange={(e) => {
            const f = e.target.value;
            const t = FACT_BY_NAME[f]?.type ?? "string";
            const op = operatorsForType(t)[0]?.op ?? "eq";
            setInner({ t: "leaf", fact: f, op, value: "" });
          }}
          className={ctrl}
        >
          {FACT_CATALOG.map((f) => (
            <option key={f.name} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Operator"
          value={leaf.op}
          onChange={(e) =>
            setInner({ ...leaf, op: e.target.value as OperatorName })
          }
          className={ctrl}
        >
          {ops.map((o) => (
            <option key={o.op} value={o.op}>
              {o.label}
            </option>
          ))}
        </select>
        <ValueInput
          leaf={leaf}
          type={type}
          onChange={(v) => setInner({ ...leaf, value: v })}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setInner({ t: "all", children: [leaf, newLeaf()] })}
            className={smallBtn}
            title="Combine: all conditions must match"
          >
            + AND
          </button>
          <button
            type="button"
            onClick={() => setInner({ t: "any", children: [leaf, newLeaf()] })}
            className={smallBtn}
            title="Combine: any condition may match"
          >
            + OR
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove condition"
              className="text-muted-foreground hover:text-destructive px-1"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Double negation (not-of-not) — rare; delegate so types stay sound.
  if (inner.t === "not") {
    return (
      <ConditionEditor
        node={inner}
        onChange={setInner}
        onRemove={onRemove}
        depth={depth}
      />
    );
  }

  // Group: all | any
  const group = inner;
  const children = group.children;
  const setChildren = (ch: CondNode[]) =>
    setInner({ t: group.t, children: ch });
  const isAll = group.t === "all";
  return (
    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        {notToggle}
        <div className="border-input inline-flex overflow-hidden rounded-md border text-xs">
          <button
            type="button"
            onClick={() => setInner({ t: "all", children })}
            className={`px-2 py-1 font-medium ${isAll ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
          >
            Match ALL
          </button>
          <button
            type="button"
            onClick={() => setInner({ t: "any", children })}
            className={`px-2 py-1 font-medium ${!isAll ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
          >
            Match ANY
          </button>
        </div>
        <span className="text-muted-foreground text-xs">of:</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove group"
            className="text-muted-foreground hover:text-destructive ml-auto px-1"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
      <div className="border-border flex flex-col gap-2 border-l-2 pl-2">
        {children.map((ch, i) => (
          <ConditionEditor
            key={i}
            node={ch}
            depth={depth + 1}
            onChange={(c) =>
              setChildren(children.map((x, j) => (j === i ? c : x)))
            }
            onRemove={
              children.length > 1
                ? () => setChildren(children.filter((_, j) => j !== i))
                : undefined
            }
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setChildren([...children, newLeaf()])}
          className={smallBtn}
        >
          + Condition
        </button>
        <button
          type="button"
          onClick={() =>
            setChildren([...children, { t: "all", children: [newLeaf()] }])
          }
          className={smallBtn}
        >
          + Group
        </button>
      </div>
    </div>
  );
}

function ValueInput({
  leaf,
  type,
  onChange,
}: {
  leaf: { op: OperatorName; value: string };
  type: "number" | "boolean" | "string";
  onChange: (v: string) => void;
}) {
  if (leaf.op === "in" || leaf.op === "nin") {
    return (
      <input
        aria-label="Value"
        value={leaf.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="comma-separated"
        className={ctrl}
      />
    );
  }
  if (type === "boolean") {
    return (
      <select
        aria-label="Value"
        value={leaf.value === "false" ? "false" : "true"}
        onChange={(e) => onChange(e.target.value)}
        className={ctrl}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return (
    <input
      aria-label="Value"
      type={type === "number" ? "number" : "text"}
      value={leaf.value}
      onChange={(e) => onChange(e.target.value)}
      className={`${ctrl} ${type === "number" ? "w-28" : ""}`}
    />
  );
}
