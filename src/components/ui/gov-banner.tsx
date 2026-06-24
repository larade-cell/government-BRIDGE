"use client";

import { useState } from "react";

import { ChevronRightIcon } from "~/components/ui/icons";
import { useI18n } from "~/i18n/client";

/**
 * The official government banner at the very top of every page, modeled on the
 * USWDS site banner: it states what the platform is, and an expandable "Here's
 * how you know" reveals the standard .gov + HTTPS trust explanations. Bilingual
 * via the active locale. Client component so the disclosure can toggle.
 */
export function GovBanner() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="gov-banner text-xs">
      <div className="page-container flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-center sm:gap-3">
        <p className="flex items-center gap-1.5 font-medium">
          <FlagIcon className="size-3.5 shrink-0" />
          {t.gov.official}
        </p>
        <p className="text-muted-foreground flex items-center gap-1.5">
          <LockIcon className="size-3 shrink-0" />
          {t.gov.secure}
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="gov-banner-details"
          className="text-primary inline-flex w-fit items-center gap-1 font-medium underline underline-offset-2 hover:no-underline sm:ml-auto"
        >
          {t.gov.howYouKnow}
          <ChevronRightIcon
            className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div id="gov-banner-details" className="border-t border-[#dfe1e2]">
          <div className="page-container grid gap-4 py-3 sm:grid-cols-2">
            <div className="flex gap-2">
              <BuildingIcon className="text-primary mt-0.5 size-5 shrink-0" />
              <p>
                <strong className="block font-semibold">
                  {t.gov.dotGovHeading}
                </strong>
                <span className="text-muted-foreground">
                  {t.gov.dotGovBody}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <LockIcon className="text-primary mt-0.5 size-5 shrink-0" />
              <p>
                <strong className="block font-semibold">
                  {t.gov.httpsHeading}
                </strong>
                <span className="text-muted-foreground">{t.gov.httpsBody}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small U.S.-flag glyph: red/white stripes with a blue canton. */
function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" aria-hidden="true" className={className}>
      <rect width="24" height="16" fill="#f0f0f0" />
      {[0, 2, 4, 6, 8, 10, 12, 14].map((y) => (
        <rect key={y} y={y} width="24" height="1.23" fill="#b50909" />
      ))}
      <rect width="10" height="8.6" fill="#1a4480" />
    </svg>
  );
}

/** Small padlock indicating a secure connection. */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Small government-building glyph for the ".gov" explanation. */
function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 21h18" />
      <path d="M4 21V10l8-5 8 5v11" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
