"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useI18n } from "~/i18n/client";
import { fmt } from "~/i18n/config";
import { api } from "~/trpc/react";

/**
 * Resident ↔ caseworker chat. Backed by the case's non-internal notes, so a
 * message here lands in the staff queue and a caseworker's reply (marked "send
 * to resident") shows up here. Polls so replies appear without a refresh.
 */
export function CaseworkerChat() {
  const { locale, t } = useI18n();
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const thread = api.case.myThread.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const send = api.case.sendMessage.useMutation({
    onSuccess: () => {
      setText("");
      void utils.case.myThread.invalidate();
    },
  });

  const messages = thread.data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (thread.isLoading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-8 text-sm">
          …
        </CardContent>
      </Card>
    );
  }

  // No case yet — point the resident to the way one gets opened.
  if (!thread.data) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-start gap-3 py-8 text-sm">
          <p>{t.account.messagesNoCase}</p>
          <Button
            nativeButton={false}
            render={<Link href="/screening/start" />}
          >
            {t.account.newScreening}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const caseId = thread.data.case_id;
  const headerText = thread.data.caseworker_name
    ? fmt(t.account.messagesWith, { name: thread.data.caseworker_name })
    : t.account.messagesWithUnassigned;

  function handleSend() {
    const message = text.trim();
    if (!message || send.isPending) return;
    send.mutate({ case_id: caseId, message });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-5">
        <p className="text-muted-foreground text-sm font-medium">
          {headerText}
        </p>

        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label={headerText}
          className="flex max-h-[28rem] min-h-40 flex-col gap-2 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t.account.messagesEmpty}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.from === "resident";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.note}
                  </div>
                  <span className="text-muted-foreground mt-0.5 px-1 text-[11px]">
                    {mine
                      ? t.account.messageFromYou
                      : t.account.messageFromCaseworker}{" "}
                    · {new Date(m.created_at).toLocaleString(locale)}
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
            placeholder={t.account.messagesPlaceholder}
            aria-label={t.account.messagesPlaceholder}
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-w-0 flex-1 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-3"
          />
          <Button
            disabled={send.isPending || text.trim() === ""}
            onClick={handleSend}
          >
            {send.isPending
              ? t.account.messagesSending
              : t.account.messagesSend}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
