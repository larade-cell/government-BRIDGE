"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function MessagesCenter() {
  const utils = api.useUtils();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Poll so new resident messages surface without a refresh.
  const threads = api.case.staffThreads.useQuery(undefined, {
    refetchInterval: 20_000,
  });
  const list = threads.data ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Conversation list */}
      <div className="flex flex-col gap-2">
        {threads.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No conversations yet. Residents assigned to you will appear here
              once there are messages.
            </CardContent>
          </Card>
        ) : (
          list.map((tRow) => (
            <button
              key={tRow.case_id}
              type="button"
              onClick={() => setSelectedId(tRow.case_id)}
              className={`rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                selectedId === tRow.case_id ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium">
                  {tRow.resident_name}
                  {tRow.awaiting_reply && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-amber-500"
                      aria-label="Awaiting your reply"
                      title="Awaiting your reply"
                    />
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tRow.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {tRow.last_message
                  ? `${tRow.last_message.from === "resident" ? "" : "You: "}${tRow.last_message.preview}`
                  : "No messages yet"}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Selected thread */}
      <div>
        {selectedId ? (
          <Thread
            caseId={selectedId}
            onReplied={() => void utils.case.staffThreads.invalidate()}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a conversation to read and reply.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Thread({
  caseId,
  onReplied,
}: {
  caseId: string;
  onReplied: () => void;
}) {
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const thread = api.case.staffThread.useQuery(
    { case_id: caseId },
    { refetchInterval: 15_000 },
  );

  // Replies are non-internal notes, so they post to the resident's Messages
  // thread and trigger the caseworker-message notification.
  const reply = api.caseNote.create.useMutation({
    onSuccess: () => {
      setText("");
      void utils.case.staffThread.invalidate({ case_id: caseId });
      onReplied();
    },
  });

  const messages = thread.data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleSend() {
    const message = text.trim();
    if (!message || reply.isPending) return;
    reply.mutate({ case_id: caseId, note: message, is_internal: false });
  }

  if (thread.isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{thread.data?.resident_name}</span>
          <span className="text-xs text-muted-foreground">
            {thread.data?.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto border-t pt-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No messages yet. Send the first one below.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.from === "staff";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground"
                    }`}
                  >
                    {m.note}
                  </div>
                  <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
                    {mine ? "You" : thread.data?.resident_name} ·{" "}
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="flex items-end gap-2 border-t pt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Reply to the resident…"
            aria-label="Reply to the resident"
            className="min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            disabled={reply.isPending || text.trim() === ""}
            onClick={handleSend}
          >
            {reply.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
