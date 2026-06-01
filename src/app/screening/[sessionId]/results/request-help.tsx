"use client";

import { useState } from "react";

import { useI18n } from "~/i18n/client";
import { api } from "~/trpc/react";

const fieldClass =
  "w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none ring-1 ring-white/10 transition focus:bg-white/20 focus:ring-2 focus:ring-white/30";

export function RequestHelp({ sessionId }: { sessionId: string }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<null | { alreadyOpen: boolean }>(null);

  const create = api.case.create.useMutation({
    onSuccess: (res) => setDone({ alreadyOpen: !res.created }),
  });

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
        <p className="font-semibold text-emerald-200">
          {done.alreadyOpen ? t.results.help.doneAlready : t.results.help.doneNew}
        </p>
      </div>
    );
  }

  const trimmed = (v: string) => (v.trim() === "" ? undefined : v.trim());

  return (
    <div className="rounded-xl bg-white/10 p-6">
      <h2 className="text-xl font-semibold">{t.results.help.title}</h2>
      <p className="mt-1 text-sm text-white/70">{t.results.help.body}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/80">{t.results.help.name}</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/80">{t.results.help.email}</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-white/80">{t.results.help.phone}</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <p className="mt-2 text-xs text-white/55">{t.results.help.contactHint}</p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder={t.results.help.placeholder}
        className={`mt-3 ${fieldClass}`}
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() =>
            create.mutate({
              session_id: sessionId,
              message: trimmed(message),
              contact_name: trimmed(name),
              contact_email: trimmed(email),
              contact_phone: trimmed(phone),
            })
          }
          disabled={create.isPending}
          className="rounded-full bg-white px-5 py-2 font-semibold text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
        >
          {create.isPending ? t.results.help.requesting : t.results.help.button}
        </button>
        {create.error && (
          <span className="text-sm text-red-300">{create.error.message}</span>
        )}
      </div>
    </div>
  );
}
