import Link from "next/link";

import { Brand } from "~/components/ui/brand";
import { ArrowRightIcon } from "~/components/ui/icons";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { getI18n } from "~/i18n/server";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

const primaryPill =
  "inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 active:translate-y-px";
const ghostPill =
  "inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/20 active:translate-y-px";

export default async function Home() {
  const [session, { t }] = await Promise.all([auth(), getI18n()]);

  return (
    <HydrateClient>
      <main className="brand-gradient flex min-h-screen flex-col text-white">
        <header className="page-container flex items-center justify-between gap-3 py-5">
          <Brand href="/" />
          <div className="flex items-center gap-3">
            <LocaleToggle variant="dark" />
            {session?.user ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/15 transition hover:bg-white/20"
              >
                {t.common.dashboard}
              </Link>
            ) : (
              <Link
                href="/auth/magic-link"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition hover:text-white"
              >
                {t.common.signIn}
              </Link>
            )}
          </div>
        </header>

        <div className="page-container flex flex-1 flex-col items-center justify-center gap-10 py-16 text-center">
          <div className="flex max-w-2xl flex-col items-center gap-4 duration-500 animate-in fade-in slide-in-from-bottom-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
              {t.home.badge}
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
              {t.home.title}
            </h1>
            <p className="text-pretty text-lg text-white/80 sm:text-xl">
              {t.home.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 duration-700 animate-in fade-in">
            {session?.user && (
              <p className="text-sm text-white/70">
                {t.home.signedInAs}{" "}
                <span className="font-semibold text-white">
                  {session.user.name ?? session.user.email}
                </span>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/screening/start" className={primaryPill}>
                {t.home.startScreening}
                <ArrowRightIcon className="size-4" />
              </Link>
              {session?.user ? (
                <>
                  <Link href="/dashboard" className={ghostPill}>
                    {t.home.goToDashboard}
                  </Link>
                  <Link href="/api/auth/signout" className={ghostPill}>
                    {t.common.signOut}
                  </Link>
                </>
              ) : (
                <Link href="/auth/magic-link" className={ghostPill}>
                  {t.common.signIn}
                </Link>
              )}
            </div>
            {!session?.user && (
              <Link
                href="/auth/magic-link?staff=1"
                className="text-sm text-white/70 transition hover:text-white hover:underline"
              >
                {t.home.staffSignIn}
              </Link>
            )}
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
