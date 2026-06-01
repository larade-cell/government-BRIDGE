"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocale } from "~/i18n/actions";
import { useI18n } from "~/i18n/client";
import { LOCALES } from "~/i18n/config";
import { cn } from "~/lib/utils";

/**
 * Segmented EN/ES control. Sets the locale cookie (and account preference when
 * signed in), then refreshes so server + client re-render in the new language.
 * `variant` adapts to dark brand pages vs the light dashboards.
 */
export function LocaleToggle({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  const container =
    variant === "dark"
      ? "bg-white/10 ring-white/15"
      : "bg-muted ring-border";

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full p-0.5 ring-1",
        container,
        pending && "opacity-60",
        className,
      )}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        const activeCls =
          variant === "dark"
            ? "bg-white text-slate-900 shadow-sm"
            : "bg-background text-foreground shadow-sm";
        const idleCls =
          variant === "dark"
            ? "text-white/70 hover:text-white"
            : "text-muted-foreground hover:text-foreground";
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={active}
            disabled={pending}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors outline-none",
              active ? activeCls : idleCls,
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
