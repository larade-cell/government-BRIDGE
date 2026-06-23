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

// Referral status is automated, not hand-picked: a badge reflects where the
// referral is in its lifecycle (draft → sent → accepted → closed).
const REFERRAL_STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-sky-100 text-sky-700",
  accepted: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-500",
};

function selectClass() {
  return "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
}

const SOURCES = [
  { value: "", label: "All requests" },
  { value: "screening", label: "From screening" },
  { value: "chatbot", label: "From chat" },
  { value: "document_review", label: "Document review" },
] as const;

// How each case source presents in the queue — a compact badge and a longer
// label for the detail pane. Unknown sources fall back to the screening default.
const DEFAULT_SOURCE_BADGE = {
  label: "Screening",
  className: "bg-sky-100 text-sky-700",
};
const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  chatbot: { label: "Chat", className: "bg-violet-100 text-violet-700" },
  document_review: {
    label: "Document",
    className: "bg-amber-100 text-amber-700",
  },
  screening: DEFAULT_SOURCE_BADGE,
};
const DEFAULT_SOURCE_DETAIL = "Direct request";
const SOURCE_DETAIL: Record<string, string> = {
  chatbot: "Chat assistant",
  document_review: "Document review",
  screening: DEFAULT_SOURCE_DETAIL,
};

export function CaseQueue({ currentUserId }: { currentUserId: string | null }) {
  const utils = api.useUtils();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [source, setSource] = useState<
    "" | "screening" | "chatbot" | "document_review"
  >("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = api.case.list.useQuery({
    ...(statusFilter
      ? { status: statusFilter as (typeof STATUSES)[number] }
      : {}),
    ...(source ? { source } : {}),
  });

  const claim = api.case.update.useMutation({
    onSuccess: () => void utils.case.list.invalidate(),
  });

  const cases = list.data?.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
      {/* Queue */}
      <div className="flex flex-col gap-3">
        {/* Separate screening requests from chatbot handoffs. */}
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSource(s.value)}
              aria-pressed={source === s.value}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                source === s.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
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
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        (SOURCE_BADGE[c.source] ?? DEFAULT_SOURCE_BADGE)
                          .className
                      }`}
                    >
                      {(SOURCE_BADGE[c.source] ?? DEFAULT_SOURCE_BADGE).label}
                    </span>
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

  const [refNeed, setRefNeed] = useState("");
  const [refOrg, setRefOrg] = useState("");

  const detail = api.case.byId.useQuery({ id: caseId });
  const notes = api.caseNote.list.useQuery({ case_id: caseId });
  const orgs = api.organization.list.useQuery();

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
  const refetchCase = () => void utils.case.byId.invalidate({ id: caseId });
  const createReferral = api.referral.create.useMutation({
    onSuccess: () => {
      setRefNeed("");
      setRefOrg("");
      refetchCase();
    },
  });
  const updateReferral = api.referral.update.useMutation({
    onSuccess: refetchCase,
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
              nativeButton={false}
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
          {c.session_id ? (
            <>
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
            </>
          ) : (
            <p className="text-muted-foreground">
              Source:{" "}
              <span className="text-foreground">
                {SOURCE_DETAIL[c.source] ?? DEFAULT_SOURCE_DETAIL}
              </span>
            </p>
          )}
        </div>

        {/* Referrals — only sessions can be referred (chat-only cases can't). */}
        {c.session_id && c.screening_sessions && (
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-semibold">Referrals</Label>
            <p className="-mt-1 text-xs text-muted-foreground">
              Status updates automatically: assign an organization to send it,
              mark it accepted when they confirm, and it closes when the case is
              resolved.
            </p>
            {c.screening_sessions.referrals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No referrals yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {c.screening_sessions.referrals.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{r.need_category}</span>
                      <span className="ml-2 text-muted-foreground">
                        {r.organizations?.name ?? "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label="Organization"
                        value={r.organization_id ?? ""}
                        disabled={r.status === "closed"}
                        onChange={(e) =>
                          updateReferral.mutate({
                            id: r.id,
                            organization_id: e.target.value || null,
                          })
                        }
                        className={selectClass()}
                      >
                        <option value="">Unassigned</option>
                        {(orgs.data ?? []).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          REFERRAL_STATUS_STYLES[r.status] ?? ""
                        }`}
                      >
                        {r.status}
                      </span>
                      {/* The one transition the system can't observe on its own:
                          a one-click confirmation that the org accepted. */}
                      {r.status === "sent" && (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={updateReferral.isPending}
                          onClick={() =>
                            updateReferral.mutate({
                              id: r.id,
                              status: "accepted",
                            })
                          }
                        >
                          Mark accepted
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Add a referral */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={refNeed}
                onChange={(e) => setRefNeed(e.target.value)}
                placeholder="Need (e.g. food, housing)"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <select
                aria-label="Organization for new referral"
                value={refOrg}
                onChange={(e) => setRefOrg(e.target.value)}
                className={selectClass()}
              >
                <option value="">Unassigned</option>
                {(orgs.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={createReferral.isPending || refNeed.trim() === ""}
                onClick={() =>
                  createReferral.mutate({
                    session_id: c.session_id!,
                    need_category: refNeed.trim(),
                    organization_id: refOrg || undefined,
                  })
                }
              >
                Add referral
              </Button>
            </div>
          </div>
        )}

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
