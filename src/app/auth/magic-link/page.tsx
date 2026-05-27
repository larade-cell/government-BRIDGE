import { requestMagicLink } from "./actions";

export default function MagicLinkPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="w-full max-w-sm rounded-xl bg-white/10 p-8">
        <h1 className="mb-6 text-2xl font-bold">Sign in</h1>
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
              placeholder="you@example.com"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-full bg-white/20 px-6 py-2 font-semibold transition hover:bg-white/30"
          >
            Send magic link
          </button>
        </form>
      </div>
    </main>
  );
}
