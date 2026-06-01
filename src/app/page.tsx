import Link from "next/link";

import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#020617] text-white">
        <div className="container flex flex-col items-center justify-center gap-10 px-4 py-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
              BRIDGE
            </h1>
            <p className="max-w-xl text-lg text-white/80">
              Benefits Resource Intelligence &amp; Digital Guidance Engine —
              find out which benefits you may qualify for and get help applying.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            {session?.user && (
              <p className="text-xl">
                Signed in as{" "}
                <span className="font-semibold">
                  {session.user.name ?? session.user.email}
                </span>
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/screening/start"
                className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-white/90"
              >
                Start screening
              </Link>
              {session?.user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="rounded-full bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
                  >
                    Go to my dashboard
                  </Link>
                  <Link
                    href="/api/auth/signout"
                    className="rounded-full bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
                  >
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  href="/auth/magic-link"
                  className="rounded-full bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
                >
                  Sign in
                </Link>
              )}
            </div>
            {!session?.user && (
              <Link
                href="/auth/magic-link?staff=1"
                className="text-sm text-white/70 transition hover:text-white hover:underline"
              >
                Staff sign-in →
              </Link>
            )}
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
