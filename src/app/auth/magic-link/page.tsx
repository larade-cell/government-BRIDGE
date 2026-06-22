import Link from "next/link";

import { Brand } from "~/components/ui/brand";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { getI18n } from "~/i18n/server";

import { requestMagicLink } from "./actions";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const [{ staff }, { t }] = await Promise.all([searchParams, getI18n()]);
  const isStaff = staff === "1";

  return (
    <main
      id="main-content"
      className="brand-gradient flex min-h-screen flex-col items-center justify-center px-4 text-white"
    >
      <div className="w-full max-w-sm duration-500 animate-in fade-in slide-in-from-bottom-3">
        <div className="mb-6 flex items-center justify-between">
          <Brand href="/" />
          <LocaleToggle variant="dark" />
        </div>
        <div className="rounded border-t-4 border-t-white/80 bg-white/10 p-8 shadow-xl ring-1 ring-white/10 backdrop-blur">
          <h1 className="mb-1 font-heading text-2xl font-bold">
            {isStaff ? t.auth.staffTitle : t.auth.signInTitle}
          </h1>
          <p className="mb-6 text-sm text-white/70">
            {isStaff ? t.auth.staffSubtitle : t.auth.signInSubtitle}
          </p>
          <form action={requestMagicLink} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t.auth.name}</span>
              <input
                type="text"
                name="name"
                required
                autoComplete="name"
                className="rounded-lg bg-white/15 px-3 py-2 text-white placeholder-white/50 outline-none ring-1 ring-white/10 transition focus:bg-white/20 focus:ring-2 focus:ring-white/40"
                placeholder={t.auth.namePlaceholder}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t.auth.email}</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="rounded-lg bg-white/15 px-3 py-2 text-white placeholder-white/50 outline-none ring-1 ring-white/10 transition focus:bg-white/20 focus:ring-2 focus:ring-white/40"
                placeholder={isStaff ? "you@agency.gov" : "you@example.com"}
              />
            </label>
            <button
              type="submit"
              className="mt-2 rounded bg-white px-6 py-3 font-bold text-[#1a4480] shadow-sm transition hover:bg-white/90 active:translate-y-px"
            >
              {t.auth.sendLink}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/70">
            <Link
              href={isStaff ? "/auth/magic-link" : "/auth/magic-link?staff=1"}
              className="transition hover:text-white hover:underline"
            >
              {isStaff ? t.auth.toResident : t.auth.toStaff}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
