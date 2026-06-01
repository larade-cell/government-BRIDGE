"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type AppRole } from "~/server/auth/config";
import { cn } from "~/lib/utils";

const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/cases", label: "Cases" },
  { href: "/admin/rules", label: "Eligibility rules", adminOnly: true },
  { href: "/admin/programs", label: "Programs & questions", adminOnly: true },
];

export function AdminNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <nav className="flex flex-col gap-1">
      {LINKS.filter((l) => !l.adminOnly || isAdmin).map((l) => {
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
