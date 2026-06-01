import Link from "next/link";

import { cn } from "~/lib/utils";

/** The BRIDGE mark: a stylized suspension bridge (deck, towers, cables). */
function BridgeMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <path d="M3 15.5h18" />
      <path d="M7.5 15.5V9.5M16.5 15.5V9.5" />
      <path d="M3 11.5q4.5 -5 9 0 t9 0" />
    </svg>
  );
}

/**
 * Brand wordmark used in every header and on the public pages. Text color is
 * inherited from context (white on the dark brand pages, foreground on the
 * light app), so callers don't need to theme it.
 */
export function Brand({
  href,
  className,
}: {
  href?: string;
  className?: string;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <BridgeMark className="size-4" />
      </span>
      <span className="font-heading text-lg font-extrabold tracking-tight">
        BRIDGE
      </span>
    </span>
  );

  return href ? (
    <Link
      href={href}
      className="inline-flex rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
