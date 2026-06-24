"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CheckCircleIcon, ExternalLinkIcon } from "~/components/ui/icons";
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
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffDone, setHandoffDone] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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
        className="bg-primary text-primary-foreground fixed right-4 bottom-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 ring-black/10 transition hover:opacity-90 active:translate-y-px sm:right-6 sm:bottom-6"
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in slide-in-from-bottom-3 fixed right-4 bottom-20 z-40 flex h-[min(70vh,32rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-2xl border shadow-2xl ring-1 duration-200 sm:right-6 sm:bottom-24">
          <header className="bg-primary text-primary-foreground flex items-center justify-between gap-2 border-b px-4 py-3">
            <span className="font-heading font-semibold">{t.chat.title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.chat.close}
              className="rounded-md p-1 transition hover:bg-white/15"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label={t.chat.title}
            className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
          >
            {/* Intro bubble */}
            <Bubble role="assistant">{t.chat.intro}</Bubble>

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.citations && m.citations.length > 0 && (
                  <div className="border-foreground/10 mt-2 border-t pt-2">
                    <p className="text-muted-foreground mb-1 text-xs font-semibold">
                      {t.chat.sources}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {m.citations.map((c, j) => (
                        <li key={j}>
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                          >
                            {c.title}
                            <ExternalLinkIcon className="size-3" />
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
                <Spinner className="text-muted-foreground size-4" />
              </Bubble>
            )}
            <div ref={endRef} />
          </div>

          {/* Handoff to a caseworker */}
          {conversationId && (
            <div className="border-t px-4 py-2">
              {handoffDone ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#216e39]">
                  <CheckCircleIcon className="size-4" />
                  {t.chat.handoffDone}
                </p>
              ) : handoffOpen ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await handoff.mutateAsync({
                        conversation_id: conversationId,
                        contact_name: contactName.trim() || undefined,
                        contact_email: contactEmail.trim() || undefined,
                        contact_phone: contactPhone.trim() || undefined,
                      });
                    } finally {
                      setHandoffDone(true);
                      setHandoffOpen(false);
                    }
                  }}
                >
                  <p className="text-muted-foreground text-xs">
                    {t.chat.handoffIntro}
                  </p>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t.results.help.name}
                    aria-label={t.results.help.name}
                    autoComplete="name"
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
                  />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={t.results.help.email}
                    aria-label={t.results.help.email}
                    autoComplete="email"
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
                  />
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder={t.results.help.phone}
                    aria-label={t.results.help.phone}
                    autoComplete="tel"
                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
                  />
                  <button
                    type="submit"
                    disabled={handoff.isPending}
                    className="bg-primary text-primary-foreground self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 disabled:opacity-60"
                  >
                    {t.chat.handoffSubmit}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setHandoffOpen(true)}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  {t.chat.handoff}
                </button>
              )}
            </div>
          )}

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
              aria-label={t.chat.placeholder}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus-visible:ring-3"
            />
            <button
              type="submit"
              disabled={busy || input.trim() === ""}
              className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            >
              {t.chat.send}
            </button>
          </form>
          <p className="bg-muted/40 text-muted-foreground px-4 py-1.5 text-[11px] leading-tight">
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
      className={cn("flex", role === "user" ? "justify-end" : "justify-start")}
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
