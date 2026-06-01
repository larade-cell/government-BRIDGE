import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  WarningIcon,
} from "./icons";

type Variant = "info" | "success" | "warning" | "error";

const VARIANTS: Record<
  Variant,
  { box: string; iconColor: string; Icon: (p: { className?: string }) => ReactNode }
> = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900",
    iconColor: "text-sky-600",
    Icon: InfoIcon,
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    iconColor: "text-emerald-600",
    Icon: CheckCircleIcon,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900",
    iconColor: "text-amber-600",
    Icon: WarningIcon,
  },
  error: {
    box: "border-destructive/30 bg-destructive/10 text-destructive",
    iconColor: "text-destructive",
    Icon: AlertCircleIcon,
  },
};

/** Inline status/error banner with an icon, used across the app's forms. */
export function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { box, iconColor, Icon } = VARIANTS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3 text-sm duration-200 animate-in fade-in slide-in-from-top-1",
        box,
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4", iconColor)} />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && (
          <div className={cn("opacity-90", title && "mt-0.5")}>{children}</div>
        )}
      </div>
    </div>
  );
}
