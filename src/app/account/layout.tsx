import Link from "next/link";

import { type NavItem } from "~/components/nav/dashboard-nav";
import { DashboardShell } from "~/components/nav/dashboard-shell";
import { getI18n } from "~/i18n/server";
import { requireUser } from "~/server/auth/page-guards";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, { t }] = await Promise.all([requireUser(), getI18n()]);

  const items: NavItem[] = [
    { href: "/account", label: t.nav.overview, icon: "grid", exact: true },
    { href: "/account/documents", label: t.nav.documents, icon: "documents" },
    { href: "/account/messages", label: t.nav.messages, icon: "messages" },
    { href: "/account/profile", label: t.nav.profile, icon: "user" },
  ];

  return (
    <DashboardShell
      userLabel={session.user.name ?? session.user.email}
      items={items}
      signOutLabel={t.common.signOut}
      headerActions={
        <Link
          href="/screening/start"
          className="hidden rounded-lg px-2.5 py-1.5 font-medium text-primary transition-colors hover:bg-primary/10 sm:inline-block"
        >
          {t.account.startNewScreening}
        </Link>
      }
    >
      {children}
    </DashboardShell>
  );
}
