import Link from "next/link";

type ErrorCode =
  | "Configuration"
  | "AccessDenied"
  | "Verification"
  | "Default"
  | string;

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
  const { error } = await searchParams;
  const { title, body } = messages[error ?? "Default"] ?? messages.Default!;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0f172a] to-[#020617] text-white">
      <div className="w-full max-w-md rounded-xl bg-white/10 p-8">
        <h1 className="mb-3 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-white/80">{body}</p>
        <div className="flex gap-3">
          <Link
            href="/auth/magic-link"
            className="rounded-full bg-white px-5 py-2 font-semibold text-slate-900 transition hover:bg-white/90"
          >
            Request a new link
          </Link>
          <Link
            href="/"
            className="rounded-full bg-white/10 px-5 py-2 font-semibold transition hover:bg-white/20"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
