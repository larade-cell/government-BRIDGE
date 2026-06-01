"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

export function RequestHelp({ sessionId }: { sessionId: string }) {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState<null | { alreadyOpen: boolean }>(null);

  const create = api.case.create.useMutation({
    onSuccess: (res) => setDone({ alreadyOpen: !res.created }),
  });

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
        <p className="font-semibold text-emerald-200">
          {done.alreadyOpen
            ? "You've already requested help — a caseworker will be in touch."
            : "Thanks — a caseworker will review your screening and follow up."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/10 p-6">
      <h2 className="text-xl font-semibold">Need help applying?</h2>
      <p className="mt-1 text-sm text-white/70">
        Request a caseworker to review your results and help you apply. Add a
        note if there&apos;s anything they should know.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder="Optional: tell us how we can help…"
        className="mt-4 w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/50 outline-none focus:bg-white/20"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={() =>
            create.mutate({
              session_id: sessionId,
              message: message.trim() === "" ? undefined : message.trim(),
            })
          }
          disabled={create.isPending}
          className="rounded-full bg-white px-5 py-2 font-semibold text-slate-900 transition hover:bg-white/90 disabled:opacity-60"
        >
          {create.isPending ? "Requesting…" : "Request help"}
        </button>
        {create.error && (
          <span className="text-sm text-red-300">{create.error.message}</span>
        )}
      </div>
    </div>
  );
}
