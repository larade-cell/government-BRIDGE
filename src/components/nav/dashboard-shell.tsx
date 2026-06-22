import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "~/components/ui/brand";
import { LocaleToggle } from "~/components/ui/locale-toggle";

import { DashboardNav, type NavItem } from "./dashboard-nav";

/**
 * The dashboard frame shared by the citizen and staff areas: a sticky
 * role-aware header (brand, context badge, role-specific actions, language,
 * sign-out), a sidebar of role-derived nav on desktop, the same nav as a
 * horizontal scroller on mobile, and a consistent content column.
 */
export function DashboardShell({
  userLabel,
  badge,
  items,
  headerActions,
  signOutLabel = "Sign out",
  showLocaleToggle = true,
  children,
}: {
  userLabel?: string | null;
  badge?: ReactNode;
  items: NavItem[];
  headerActions?: ReactNode;
  signOutLabel?: string;
  /** Resident areas are bilingual; the admin console is English-only. */
  showLocaleToggle?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Brand href="/" />
            {badge}
          </div>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {headerActions}
            {showLocaleToggle && <LocaleToggle />}
            {userLabel && (
              <span className="hidden max-w-40 truncate text-muted-foreground md:inline">
                {userLabel}
              </span>
            )}
            <Link
              href="/api/auth/signout"
              className="rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {signOutLabel}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row lg:px-8">
        <aside className="hidden md:block md:w-56 md:shrink-0">
          <DashboardNav items={items} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-5 md:hidden">
            <DashboardNav items={items} variant="horizontal" />
          </div>
          <main id="main-content" className="duration-300 animate-in fade-in">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
