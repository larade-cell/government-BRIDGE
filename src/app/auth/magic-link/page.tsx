import Link from "next/link";

import { requestMagicLink } from "./actions";

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const { staff } = await searchParams;
  const isStaff = staff === "1";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="w-full max-w-sm rounded-xl bg-white/10 p-8">
        <h1 className="mb-1 text-2xl font-bold">
          {isStaff ? "Staff sign-in" : "Sign in"}
        </h1>
        <p className="mb-6 text-sm text-white/70">
          {isStaff
            ? "Use your staff email. We'll send a one-time sign-in link."
            : "We'll email you a one-time sign-in link — no password needed."}
        </p>
        <form action={requestMagicLink} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>Name</span>
            <input
              type="text"
              name="name"
              required
              className="rounded-md bg-white/20 px-3 py-2 text-white placeholder-white/60 outline-none focus:bg-white/30"
              placeholder="Your name"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              className="rounded-md bg-white/20 px-3 py-2 text-white placeholder-white/60 outline-none focus:bg-white/30"
              placeholder={isStaff ? "you@agency.gov" : "you@example.com"}
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-white/20 px-6 py-2 font-semibold transition hover:bg-white/30"
          >
            Send magic link
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4 text-center text-sm text-white/70">
          {isStaff ? (
            <Link href="/auth/magic-link" className="hover:text-white hover:underline">
              Not staff? Resident sign-in →
            </Link>
          ) : (
            <Link
              href="/auth/magic-link?staff=1"
              className="hover:text-white hover:underline"
            >
              Staff member? Sign in here →
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
