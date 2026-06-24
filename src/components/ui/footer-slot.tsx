"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Routes that render their own footer inside the dashboard shell's offset
// content column (so the fixed sidebar doesn't cover it). The global footer is
// hidden here to avoid a duplicate and the sidebar overlap.
const SHELL_PREFIXES = ["/admin", "/account"];

/**
 * Renders the global site footer everywhere except the dashboard shell routes,
 * which place the footer themselves (see DashboardShell). Client component so it
 * can read the current path; the footer itself is still server-rendered and
 * passed in as children.
 */
export function FooterSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (SHELL_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
