"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "~/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  /** Match the path exactly (use for section roots like /admin or /account). */
  exact?: boolean;
};

/**
 * Role-agnostic dashboard navigation. The caller supplies the items (already
 * filtered by role); this renders them with active-state highlighting. Used
 * both as a vertical sidebar (desktop) and a horizontal scroller (mobile).
 */
export function DashboardNav({
  items,
  variant = "sidebar",
  className,
}: {
  items: NavItem[];
  variant?: "sidebar" | "horizontal";
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className={cn(
        variant === "sidebar"
          ? "flex flex-col gap-1"
          : "flex gap-1 overflow-x-auto pb-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
