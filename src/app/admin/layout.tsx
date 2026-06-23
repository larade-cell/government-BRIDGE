import { type NavItem } from "~/components/nav/dashboard-nav";
import { DashboardShell } from "~/components/nav/dashboard-shell";
import { requireRolePage, STAFF_ROLES } from "~/server/auth/page-guards";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, role } = await requireRolePage(STAFF_ROLES);

  const items: NavItem[] = [
    { href: "/admin", label: "Overview", exact: true },
    { href: "/admin/cases", label: "Cases" },
    ...(role === "admin"
      ? [
          { href: "/admin/rules", label: "Eligibility rules" },
          { href: "/admin/programs", label: "Programs & questions" },
          { href: "/admin/knowledge", label: "Knowledge base" },
          { href: "/admin/organizations", label: "Organizations" },
          { href: "/admin/audit", label: "Audit log" },
        ]
      : []),
  ];

  return (
    <DashboardShell
      userLabel={session.user.name ?? session.user.email}
      items={items}
      showLocaleToggle={false}
      badge={
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-white uppercase ring-1 ring-white/20">
          {role === "admin" ? "Admin" : "Staff"} console
        </span>
      }
    >
      {children}
    </DashboardShell>
  );
}
