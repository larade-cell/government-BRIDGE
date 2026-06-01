import Link from "next/link";

import { requireUser } from "~/server/auth/page-guards";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-heading text-lg font-bold">
            BRIDGE
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/screening/start"
              className="font-medium text-primary hover:underline"
            >
              Start new screening
            </Link>
            <span className="hidden text-muted-foreground sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <Link
              href="/api/auth/signout"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Sign out
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
