import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Consistent page body: a vertical stack of sections with uniform rhythm.
 * Pair with `PageHeader` at the top for a consistent structure across the app.
 */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col gap-8", className)}>{children}</div>;
}

/** Page title + optional description and right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      {/* Left rule echoes the public hero's eyebrow accent, tying the dashboard
          headings to the home page's editorial style. */}
      <div className="border-l-4 border-primary pl-4">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
