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
      {/* Red eyebrow rule (DOL brand accent) — echoes the public hero's accent
          and the top stripe, tying the dashboard headings to the federal
          navy + red identity. */}
      <div className="border-brand-accent border-l-4 pl-4">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
