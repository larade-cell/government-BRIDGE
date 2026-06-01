import Link from "next/link";

import { Brand } from "~/components/ui/brand";
import { WarningIcon } from "~/components/ui/icons";
import { getI18n } from "~/i18n/server";

// NextAuth passes an error code (Configuration | AccessDenied | Verification |
// Default | …); we look it up in `messages` and fall back to Default.
type ErrorCode = string;

const messages: Record<string, { title: string; body: string }> = {
  Verification: {
    title: "This link is no longer valid",
    body: "Magic links can only be used once and expire after a short time. If you've already signed in, you can head straight to the app. Otherwise, request a new link.",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You don't have permission to sign in. If you think this is a mistake, contact support.",
  },
  Configuration: {
    title: "Something is misconfigured",
    body: "We hit a server-side configuration problem while signing you in. Try again, or reach out if it keeps happening.",
  },
  Default: {
    title: "Something went wrong",
    body: "We couldn't complete the sign-in. Try requesting a new link.",
  },
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: ErrorCode }>;
}) {
  const [{ error }, { t }] = await Promise.all([searchParams, getI18n()]);
  const { title, body } = messages[error ?? "Default"] ?? messages.Default!;

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center justify-center px-4 text-white">
      <div className="w-full max-w-md duration-500 animate-in fade-in slide-in-from-bottom-3">
        <div className="mb-6 flex justify-center">
          <Brand href="/" />
        </div>
        <div className="rounded-2xl bg-white/10 p-8 shadow-xl ring-1 ring-white/10 backdrop-blur">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-amber-400/20 text-amber-300">
              <WarningIcon className="size-5" />
            </span>
            <h1 className="font-heading text-2xl font-bold">{title}</h1>
          </div>
          <p className="mb-6 text-white/80">{body}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/magic-link"
              className="rounded-full bg-white px-5 py-2.5 font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 active:translate-y-px"
            >
              {t.auth.errorRequestNew}
            </Link>
            <Link
              href="/"
              className="rounded-full bg-white/10 px-5 py-2.5 font-semibold ring-1 ring-white/15 transition hover:bg-white/20 active:translate-y-px"
            >
              {t.auth.errorGoHome}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
