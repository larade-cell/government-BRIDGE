"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";

const STATUSES = [
  "new",
  "in_progress",
  "waiting_on_client",
  "resolved",
  "closed",
] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  normal: "bg-slate-100 text-slate-600",
  low: "bg-slate-100 text-slate-500",
};

function selectClass() {
  return "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

export function CaseQueue({ currentUserId }: { currentUserId: string | null }) {
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = api.case.list.useQuery({
    ...(statusFilter
      ? { status: statusFilter as (typeof STATUSES)[number] }
      : {}),
  });

  const claim = api.case.update.useMutation({
    onSuccess: () => void utils.case.list.invalidate(),
  });

  const cases = list.data?.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      {/* Queue */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm">
            Status
          </Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass()}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : cases.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No cases in this view.
            </CardContent>
          </Card>
        ) : (
          cases.map((c) => {
            const mine = currentUserId && c.assigned_to === currentUserId;
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}
                className={`cursor-pointer rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                  selectedId === c.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.contact_name ?? "Anonymous resident"}
                  </span>
                  {c.priority && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        PRIORITY_STYLES[c.priority] ?? ""
                      }`}
                    >
                      {c.priority}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {c.status.replace(/_/g, " ")} ·{" "}
                    {mine
                      ? "assigned to you"
                      : c.assigned_to
                        ? "assigned"
                        : "unassigned"}
                  </span>
                  {!c.assigned_to && currentUserId && (
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={claim.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        claim.mutate({
                          id: c.id,
                          assigned_to: currentUserId,
                          ...(c.status === "new"
                            ? { status: "in_progress" }
                            : {}),
                        });
                      }}
                    >
                      Claim
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail */}
      <div>
        {selectedId ? (
          <CaseDetail
            caseId={selectedId}
            currentUserId={currentUserId}
            onChanged={() => void utils.case.list.invalidate()}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a case to view details and notes.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CaseDetail({
  caseId,
  currentUserId,
  onChanged,
}: {
  caseId: string;
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const utils = api.useUtils();
  const [note, setNote] = useState("");

  const detail = api.case.byId.useQuery({ id: caseId });
  const notes = api.caseNote.list.useQuery({ case_id: caseId });

  const update = api.case.update.useMutation({
    onSuccess: () => {
      void utils.case.byId.invalidate({ id: caseId });
      onChanged();
    },
  });
  const addNote = api.caseNote.create.useMutation({
    onSuccess: () => {
      setNote("");
      void utils.caseNote.list.invalidate({ case_id: caseId });
    },
  });

  if (detail.isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }
  if (detail.error) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">
          {detail.error.message}
        </CardContent>
      </Card>
    );
  }

  const c = detail.data!;
  const mine = currentUserId && c.assigned_to === currentUserId;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Status</Label>
            <select
              value={c.status}
              onChange={(e) =>
                update.mutate({
                  id: caseId,
                  status: e.target.value as (typeof STATUSES)[number],
                })
              }
              className={selectClass()}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Priority</Label>
            <select
              value={c.priority ?? "normal"}
              onChange={(e) =>
                update.mutate({
                  id: caseId,
                  priority: e.target.value as (typeof PRIORITIES)[number],
                })
              }
              className={selectClass()}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {currentUserId &&
            (mine ? (
              <Button
                size="sm"
                variant="outline"
                disabled={update.isPending}
                onClick={() => update.mutate({ id: caseId, assigned_to: null })}
              >
                Release
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: caseId,
                    assigned_to: currentUserId,
                    ...(c.status === "new" ? { status: "in_progress" } : {}),
                  })
                }
              >
                {c.assigned_to ? "Reassign to me" : "Claim"}
              </Button>
            ))}
        </div>

        {c.priority_reason && (
          <p className="-mt-1 text-xs text-muted-foreground">
            Auto-prioritized: {c.priority_reason}
          </p>
        )}

        {/* Who needs help + how to reach them */}
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Contact
          </p>
          <p className="mt-1 font-medium">
            {c.contact_name ?? "Anonymous resident"}
          </p>
          {c.contact_email && (
            <p className="text-muted-foreground">{c.contact_email}</p>
          )}
          {c.contact_phone && (
            <p className="text-muted-foreground">{c.contact_phone}</p>
          )}
          {c.contact_email ? (
            <Button
              size="sm"
              className="mt-2"
              render={
                <a
                  href={`mailto:${c.contact_email}?subject=${encodeURIComponent(
                    "Your BRIDGE benefits screening",
                  )}`}
                />
              }
            >
              Email {c.contact_name ?? "resident"}
            </Button>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              No contact info provided — follow up via the screening session.
            </p>
          )}
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">
            Screening session:{" "}
            <span className="font-mono text-foreground">{c.session_id}</span>
          </p>
          {c.screening_sessions && (
            <p className="mt-1 text-muted-foreground">
              {c.screening_sessions.completed_at
                ? "Completed"
                : `In progress (step ${c.screening_sessions.current_step ?? 0})`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">Notes</Label>
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note…"
              rows={2}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <div>
              <Button
                size="sm"
                disabled={addNote.isPending || note.trim() === ""}
                onClick={() =>
                  addNote.mutate({ case_id: caseId, note: note.trim() })
                }
              >
                {addNote.isPending ? "Adding…" : "Add note"}
              </Button>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {(notes.data?.data ?? []).map((n) => (
              <li key={n.id} className="rounded-lg border px-3 py-2 text-sm">
                <p>{n.note}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleString()}
                  {n.is_internal ? " · internal" : " · from resident"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
