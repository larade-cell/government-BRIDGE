import { getI18n } from "~/i18n/server";

/**
 * The official government banner that sits at the very top of every page,
 * modeled on the USWDS site banner. It states what the platform is and
 * reassures users about privacy up front — a hallmark of trustworthy public
 * services. Static, high-contrast, and bilingual via the active locale.
 */
export async function GovBanner() {
  const { t } = await getI18n();
  return (
    <div className="gov-banner">
      <div className="page-container flex flex-col gap-0.5 py-1.5 text-xs sm:flex-row sm:items-center sm:gap-3">
        <p className="flex items-center gap-1.5 font-medium">
          <FlagIcon className="size-3.5 shrink-0" />
          {t.gov.official}
        </p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <LockIcon className="size-3 shrink-0" />
          {t.gov.secure}
        </p>
      </div>
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
