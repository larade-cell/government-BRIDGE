import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Lightweight CSS-only tooltip — shows `label` on hover/focus of `children`.
 * No JS or external dependency; the trigger should be focusable for keyboard
 * users (e.g. wrap a button or an element with tabIndex).
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-center text-xs leading-snug text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
