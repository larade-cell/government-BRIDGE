"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BookIcon,
  BriefcaseIcon,
  BuildingIcon,
  ClipboardIcon,
  FileTextIcon,
  GridIcon,
  HistoryIcon,
  ScaleIcon,
  UserIcon,
} from "~/components/ui/icons";
import { cn } from "~/lib/utils";

/**
 * Nav icons are referenced by string key (not a component) so `NavItem`s stay
 * serializable when a Server Component layout passes them into this Client
 * Component. The key resolves to a component here, on the client.
 */
const NAV_ICONS = {
  grid: GridIcon,
  documents: FileTextIcon,
  user: UserIcon,
  cases: BriefcaseIcon,
  rules: ScaleIcon,
  programs: ClipboardIcon,
  knowledge: BookIcon,
  organizations: BuildingIcon,
  audit: HistoryIcon,
} as const;

export type NavIcon = keyof typeof NAV_ICONS;

export type NavItem = {
  href: string;
  label: string;
  /** Key into the nav icon set (kept a string so items cross the RSC boundary). */
  icon?: NavIcon;
  /** Match the path exactly (use for section roots like /admin or /account). */
  exact?: boolean;
};

/**
 * Role-agnostic dashboard navigation, styled for the navy sidebar (and the
 * navy mobile strip). The caller supplies the items (already filtered by
 * role); this renders them with icon + active-state highlighting. Used both as
 * a vertical sidebar (desktop) and a horizontal scroller (mobile).
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
        const Icon = item.icon ? NAV_ICONS[item.icon] : null;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-white/15 text-white ring-1 ring-white/15"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {Icon && <Icon className="size-4 shrink-0" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
