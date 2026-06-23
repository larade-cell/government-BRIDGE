import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "~/components/ui/brand";
import { ArrowRightIcon } from "~/components/ui/icons";
import { LocaleToggle } from "~/components/ui/locale-toggle";

import { DashboardNav, type NavItem } from "./dashboard-nav";

/** Two uppercase initials from a name or email, for the sidebar avatar. */
function initialsOf(label?: string | null): string {
  if (!label) return "—";
  const name = label.split("@")[0]!.replace(/[._-]+/g, " ").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * The dashboard frame shared by the citizen and staff areas, styled as a
 * classic admin console: a full-height federal-navy sidebar (brand, profile,
 * icon nav, sign-out), a light sticky top bar for language/account actions,
 * the same nav as a navy horizontal scroller on mobile, and a centered
 * content column.
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
      {/* Fixed navy sidebar (desktop). */}
      <aside className="brand-gradient fixed inset-y-0 left-0 z-40 hidden w-64 flex-col text-white md:flex">
        <div className="flex h-16 items-center px-5">
          <Brand href="/" />
        </div>

        {/* Profile block — avatar + name + role badge, like the reference
            admin templates. */}
        <div className="mx-3 mb-4 flex items-center gap-3 rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold ring-1 ring-white/20">
            {initialsOf(userLabel)}
          </span>
          <div className="min-w-0">
            {userLabel && (
              <p className="truncate text-sm font-semibold">{userLabel}</p>
            )}
            {badge && <div className="mt-0.5">{badge}</div>}
          </div>
        </div>

        <DashboardNav items={items} className="flex-1 overflow-y-auto px-3" />

        <div className="border-t border-white/10 p-3">
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowRightIcon className="size-4 shrink-0" />
            {signOutLabel}
          </Link>
        </div>
      </aside>

      {/* Main column, offset by the sidebar on desktop. */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
          {/* Brand shows in the bar only on mobile (sidebar hidden there). */}
          <div className="flex items-center gap-2.5 md:hidden">
            <Brand href="/" />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {headerActions}
            {showLocaleToggle && <LocaleToggle />}
            <Link
              href="/api/auth/signout"
              className="rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              {signOutLabel}
            </Link>
          </div>
        </header>

        {/* Mobile nav: navy strip mirroring the sidebar styling. */}
        <div className="brand-gradient px-3 py-2 md:hidden">
          <DashboardNav items={items} variant="horizontal" />
        </div>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 duration-300 animate-in fade-in sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
