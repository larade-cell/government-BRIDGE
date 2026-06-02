"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "~/components/ui/spinner";
import { useI18n } from "~/i18n/client";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

type Citation = { title: string; url: string; source_id: string | null };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

// Routes where the resident chatbot shouldn't appear (staff console, auth, api).
const HIDDEN_PREFIXES = ["/admin", "/auth", "/api"];

export function ChatWidget() {
  const pathname = usePathname();
  const { locale, t } = useI18n();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [handoffDone, setHandoffDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = api.ai.ask.useMutation();
  const send = api.ai.sendMessage.useMutation();
  const handoff = api.ai.handoff.useMutation();
  const busy = ask.isPending || send.isPending;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, busy]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  async function handleSend() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    try {
      if (!conversationId) {
        const res = await ask.mutateAsync({
          question: text,
          language_code: locale,
        });
        setConversationId(res.conversation_id);
        setMessages((m) => [
          ...m,
          { role: "assistant", content: res.answer, citations: res.citations },
        ]);
      } else {
        const msg = await send.mutateAsync({
          conversation_id: conversationId,
          content: text,
        });
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: msg.content,
            citations: (msg.citations as Citation[] | null) ?? [],
          },
        ]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t.chat.error }]);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.chat.launch}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-1 ring-black/10 transition hover:opacity-90 active:translate-y-px sm:right-6 sm:bottom-6"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed right-4 bottom-20 z-40 flex h-[min(70vh,32rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-200 animate-in fade-in slide-in-from-bottom-3 sm:right-6 sm:bottom-24">
          <header className="flex items-center justify-between gap-2 border-b bg-primary px-4 py-3 text-primary-foreground">
            <span className="font-heading font-semibold">{t.chat.title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.chat.close}
              className="rounded-md p-1 transition hover:bg-white/15"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {/* Intro bubble */}
            <Bubble role="assistant">{t.chat.intro}</Bubble>

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.citations && m.citations.length > 0 && (
                  <div className="mt-2 border-t border-foreground/10 pt-2">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {t.chat.sources}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {m.citations.map((c, j) => (
                        <li key={j}>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {c.title} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Bubble>
            ))}

            {busy && (
              <Bubble role="assistant">
                <Spinner className="size-4 text-muted-foreground" />
              </Bubble>
            )}
            <div ref={endRef} />
          </div>

          {/* Handoff + disclaimer */}
          <div className="border-t px-4 py-2">
            {handoffDone ? (
              <p className="text-xs text-emerald-600">{t.chat.handoffDone}</p>
            ) : (
              conversationId && (
                <button
                  type="button"
                  disabled={handoff.isPending}
                  onClick={async () => {
                    try {
                      await handoff.mutateAsync({ conversation_id: conversationId });
                    } finally {
                      setHandoffDone(true);
                    }
                  }}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-60"
                >
                  {t.chat.handoff}
                </button>
              )
            )}
          </div>

          {/* Composer */}
          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.chat.placeholder}
              className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <button
              type="submit"
              disabled={busy || input.trim() === ""}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {t.chat.send}
            </button>
          </form>
          <p className="bg-muted/40 px-4 py-1.5 text-[11px] leading-tight text-muted-foreground">
            {t.chat.disclaimer}
          </p>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex",
        role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}
