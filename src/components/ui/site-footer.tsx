import { getI18n } from "~/i18n/server";

/**
 * Government site footer, modeled on the USWDS "Identifier" pattern: an agency
 * masthead plus the federally-required links every executive-branch site must
 * surface (Accessibility, FOIA, No FEAR, OIG, Performance, Privacy, About).
 *
 * Uses a TEXT agency identifier, not the DOL seal — federal seals are legally
 * restricted (18 U.S.C. §506/§1017) and must not imply official status in an
 * unauthorized build. The "official website" masthead line is likewise only
 * appropriate in an authorized DOL deployment.
 *
 * Links open dol.gov in a new tab; labels come from the i18n catalog (URLs are
 * not translated). A couple of deep hrefs (No FEAR, Performance) point at stable
 * parent pages and should be confirmed against the live dol.gov footer.
 */
export async function SiteFooter() {
  const { t } = await getI18n();

  // The seven USWDS Identifier required links.
  const requiredLinks = [
    { label: t.footer.about, href: "https://www.dol.gov/general/aboutdol" },
    {
      label: t.footer.accessibility,
      href: "https://www.dol.gov/general/aboutdol/accessibility",
    },
    { label: t.footer.foia, href: "https://www.dol.gov/general/foia" },
    {
      label: t.footer.noFear,
      href: "https://www.dol.gov/agencies/oasam/centers-offices/civil-rights-center",
    },
    { label: t.footer.oig, href: "https://www.oig.dol.gov/" },
    {
      label: t.footer.performance,
      href: "https://www.dol.gov/general/aboutdol/budget",
    },
    {
      label: t.footer.privacy,
      href: "https://www.dol.gov/general/privacynotice",
    },
  ];

  const secondaryLinks = [
    {
      label: t.footer.notices,
      href: "https://www.dol.gov/general/aboutdol/website-policies",
    },
    { label: t.footer.usagov, href: "https://www.usa.gov" },
    { label: t.footer.votegov, href: "https://vote.gov" },
  ];

  return (
    <footer
      aria-labelledby="footer-agency"
      className="brand-gradient border-brand-accent border-t-4 text-white"
    >
      <div className="page-container flex flex-col gap-6 py-10">
        {/* Agency identifier — text masthead, no seal. */}
        <div>
          <p id="footer-agency" className="font-heading text-lg font-bold">
            {t.footer.agency}
          </p>
          <p className="mt-1 text-sm text-white/70">{t.footer.official}</p>
        </div>

        {/* Required federal links */}
        <nav aria-label={t.footer.requiredHeading}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {requiredLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 underline-offset-4 hover:underline"
                >
                  {l.label}
                  <span className="sr-only"> {t.results.opensNewTab}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Secondary notices + cross-government links */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-sm text-white/70">
          {secondaryLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:text-white hover:underline"
            >
              {l.label}
              <span className="sr-only"> {t.results.opensNewTab}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
