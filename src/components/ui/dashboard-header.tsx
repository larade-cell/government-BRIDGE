import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "./brand";

/**
 * Sticky app header shared by the citizen and admin dashboards — one brand,
 * one layout. `badge` shows a context chip (e.g. "Admin console"); `children`
 * are extra nav items rendered before the user label and sign-out.
 */
export function DashboardHeader({
  userLabel,
  badge,
  children,
}: {
  userLabel?: string | null;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Brand href="/" />
          {badge}
        </div>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          {children}
          {userLabel && (
            <span className="hidden max-w-40 truncate text-muted-foreground md:inline">
              {userLabel}
            </span>
          )}
          <Link
            href="/api/auth/signout"
            className="rounded-lg px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign out
          </Link>
        </nav>
      </div>
    </header>
  );
}
