import Link from "next/link";

import { DashboardHeader } from "~/components/ui/dashboard-header";
import { LocaleToggle } from "~/components/ui/locale-toggle";
import { getI18n } from "~/i18n/server";
import { requireUser } from "~/server/auth/page-guards";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, { t }] = await Promise.all([requireUser(), getI18n()]);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <DashboardHeader userLabel={session.user.name ?? session.user.email}>
        <LocaleToggle />
        <Link
          href="/screening/start"
          className="rounded-lg px-2.5 py-1.5 font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {t.account.startNewScreening}
        </Link>
      </DashboardHeader>
      <main className="mx-auto max-w-5xl px-4 py-8 duration-300 animate-in fade-in sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
