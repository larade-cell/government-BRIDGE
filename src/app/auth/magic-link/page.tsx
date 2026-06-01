import Link from "next/link";

import { Brand } from "~/components/ui/brand";

import { requestMagicLink } from "./actions";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const { staff } = await searchParams;
  const isStaff = staff === "1";

  return (
    <main className="brand-gradient flex min-h-screen flex-col items-center justify-center px-4 text-white">
      <div className="w-full max-w-sm duration-500 animate-in fade-in slide-in-from-bottom-3">
        <div className="mb-6 flex justify-center">
          <Brand href="/" />
        </div>
        <div className="rounded-2xl bg-white/10 p-8 shadow-xl ring-1 ring-white/10 backdrop-blur">
          <h1 className="mb-1 font-heading text-2xl font-bold">
            {isStaff ? "Staff sign-in" : "Sign in"}
          </h1>
          <p className="mb-6 text-sm text-white/70">
            {isStaff
              ? "Use your staff email. We'll send a one-time sign-in link."
              : "We'll email you a one-time sign-in link — no password needed."}
          </p>
          <form action={requestMagicLink} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Name</span>
              <input
                type="text"
                name="name"
                required
                autoComplete="name"
                className="rounded-lg bg-white/15 px-3 py-2 text-white placeholder-white/50 outline-none ring-1 ring-white/10 transition focus:bg-white/20 focus:ring-2 focus:ring-white/40"
                placeholder="Your name"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Email</span>
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
              className="mt-2 rounded-full bg-white px-6 py-2.5 font-semibold text-slate-900 shadow-sm transition hover:bg-white/90 active:translate-y-px"
            >
              Send magic link
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/70">
            {isStaff ? (
              <Link
                href="/auth/magic-link"
                className="transition hover:text-white hover:underline"
              >
                Not staff? Resident sign-in →
              </Link>
            ) : (
              <Link
                href="/auth/magic-link?staff=1"
                className="transition hover:text-white hover:underline"
              >
                Staff member? Sign in here →
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
