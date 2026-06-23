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
    { href: "/admin", label: "Overview", icon: "grid", exact: true },
    { href: "/admin/cases", label: "Cases", icon: "cases" },
    { href: "/admin/messages", label: "Messages", icon: "messages" },
    ...(role === "admin"
      ? ([
          { href: "/admin/rules", label: "Eligibility rules", icon: "rules" },
          {
            href: "/admin/programs",
            label: "Programs & questions",
            icon: "programs",
          },
          { href: "/admin/knowledge", label: "Knowledge base", icon: "knowledge" },
          {
            href: "/admin/organizations",
            label: "Organizations",
            icon: "organizations",
          },
          { href: "/admin/audit", label: "Audit log", icon: "audit" },
        ] satisfies NavItem[])
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
