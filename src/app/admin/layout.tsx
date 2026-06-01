import { DashboardHeader } from "~/components/ui/dashboard-header";
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
      <DashboardHeader
        userLabel={session.user.name ?? session.user.email}
        badge={
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-primary uppercase">
            {role === "admin" ? "Admin" : "Staff"} console
          </span>
        }
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 duration-300 animate-in fade-in sm:px-6 md:flex-row lg:px-8">
        <aside className="md:w-56 md:shrink-0">
          <AdminNav role={role} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
