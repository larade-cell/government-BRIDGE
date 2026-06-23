import * as React from "react";

import { cn } from "~/lib/utils";

/**
 * Small inline-SVG icon set (lucide-style strokes). Inline rather than an icon
 * dependency to keep the bundle tiny and avoid version drift. All inherit
 * `currentColor` and default to size-4; pass `className` to resize/recolor.
 */
function Icon({
  className,
  children,
  ...rest
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
      {...rest}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export function InfoIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Icon>
  );
}

export function CheckCircleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12 2.5 2.5 4.5-4.5" />
    </Icon>
  );
}

export function WarningIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function AlertCircleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </Icon>
  );
}

export function ArrowLeftIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Icon>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function ExternalLinkIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </Icon>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

export function GlobeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Icon>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Icon>
  );
}

export function GridIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </Icon>
  );
}

export function FileTextIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8M16 17H8M10 9H8" />
    </Icon>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Icon>
  );
}

export function BriefcaseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </Icon>
  );
}

export function ScaleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3v18M5 7h14M7 21h10" />
      <path d="m5 7-3 6h6z" />
      <path d="m19 7-3 6h6z" />
    </Icon>
  );
}

export function ClipboardIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </Icon>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  );
}

export function BuildingIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </Icon>
  );
}

export function HistoryIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-6.36 2.64L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

export function TrendingUpIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
      <path d="M16 7h6v6" />
    </Icon>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m6.3 6.3 2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1" />
    </Icon>
  );
}
