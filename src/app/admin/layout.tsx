import Link from "next/link";

import { requireRolePage, STAFF_ROLES } from "~/server/auth/page-guards";

import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, role } = await requireRolePage(STAFF_ROLES);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="font-heading text-lg font-bold">
              BRIDGE
            </Link>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
              {role === "admin" ? "Admin" : "Staff"} console
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
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

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <AdminNav role={role} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
