# U.S. Department of Labor — Brand & Compliance Discovery

A sourced reference for building this app in the DOL's official style. Every
figure here traces to an authoritative source (linked inline). DOL's public web
identity is **the federal DOL seal + a U.S. Web Design System (USWDS) theme** —
DOL does not publish a separate proprietary brand-token microsite.

> ⚠️ **Verification caveat:** `dol.gov` returns **HTTP 403** to automated
> requests, so DOL's *compiled production CSS* could not be read directly. The
> color/type values below are the **USWDS standard tokens** DOL's site is built
> on (canonical hex from the USWDS docs). To capture DOL's exact production
> token map, inspect `https://www.dol.gov` live in a browser. No hex below is
> guessed — all come from USWDS documentation.

---

## 1. Logos & brand assets

| Asset | Location / source | Notes |
|---|---|---|
| **DOL seal (SVG)** | `./assets/dol-seal.svg` (downloaded) | Public-domain artwork; **restricted use** — see `assets/NOTICE.md` |
| Seal provenance | https://commons.wikimedia.org/wiki/File:Seal_of_the_United_States_Department_of_Labor.svg | Source notes EPS originates from DOL |
| DOL logotype/wordmark | https://en.m.wikipedia.org/wiki/File:DOL_logo.svg | Simpler wordmark variant |
| Canonical hub | https://www.dol.gov/general/aboutdol | DOL "About" landing (403 to bots; live for humans) |

**Usage restrictions (critical):** federal agency seals are criminally
restricted regardless of public-domain copyright — **18 U.S.C. §506** and
**§1017** (forging/altering or wrongfully using a government seal: up to 5 yrs).
You may *display* the seal to refer to DOL, but must not alter it or use it to
imply DOL endorsement/official status. **Do not ship the real seal in a
non-official deployment.** Full detail in [`assets/NOTICE.md`](./assets/NOTICE.md).

---

## 2. Primary & secondary colors (USWDS tokens)

DOL's site is USWDS-based. Canonical values from the USWDS theme/system token
docs: https://designsystem.digital.gov/design-tokens/color/theme-tokens/

### Primary — blue / federal navy (the dominant brand color)
| Theme token | System token | Hex |
|---|---|---|
| `primary` | `blue-60v` | `#005ea2` |
| `primary-dark` | `blue-warm-70v` | **`#1a4480`** (federal navy) |
| `primary-darker` | `blue-warm-80v` | `#162e51` |
| `primary-light` | `blue-30` | `#73b3e7` |

### Secondary — red (the accent)
| Theme token | System token | Hex |
|---|---|---|
| `secondary` | `red-50` | **`#d83933`** |
| `secondary-vivid` | `red-cool-50v` | `#e41d3d` |
| `secondary-dark` | `red-60v` | `#b50909` |
| `secondary-darker` | `red-70v` | `#8b0a03` |

### Base — gray neutrals
| Theme token | System token | Hex |
|---|---|---|
| `base-lightest` | `gray-5` | `#f0f0f0` |
| `base-lighter` | `gray-cool-10` | `#dfe1e2` |
| `base-dark` | `gray-cool-60` | `#565c65` |
| `ink` | `gray-90` | `#1b1b1b` |

**How this maps to our app (`src/styles/globals.css`):** our navy `--primary
#1a4480`, `--link #005ea2`, grays (`#f0f0f0` / `#dfe1e2` / `#565c65` / `#1b1b1b`)
and error `--destructive #b50909` already match USWDS exactly. The one value to
reconcile is **`--brand-accent`**: we currently use `#b31942` (an AA-safe crimson
chosen before this research). The **canonical DOL/USWDS secondary red is
`#d83933`** (`red-50`).
- For **decorative** use (top stripe, eyebrow rules — non-text, needs 3:1):
  switch to `#d83933` to be canonical.
- For **white-text-on-red** (badges/buttons): `#d83933` only reaches ~3.4:1
  (fails AA for small text). Use `red-70v #8b0a03` (or `#b50909`) there.
- Keep `--destructive` (`#b50909`) for **errors only** so "emphasis red" and
  "error red" stay distinguishable.

---

## 3. Typography

USWDS typefaces (https://designsystem.digital.gov/design-tokens/typesetting/font-family/):

| Role | Typeface | In our app? |
|---|---|---|
| Body / UI (sans) | **Public Sans** (built for the U.S. government; USWDS's featured sans) | ✅ `--font-public-sans` |
| Headings (serif) | **Merriweather** | ✅ `--font-merriweather` (`h1`/`h2` via `font-display`) |
| Default sans token | Source Sans Pro (USWDS token default) | n/a (we use Public Sans, which is recommended) |
| Mono | Roboto Mono | n/a |

**Our type stack already matches DOL/USWDS.** Public Sans + Merriweather is the
canonical federal pairing. (DOL's *production* sans couldn't be confirmed via the
403'd CSS, but Public Sans is the USWDS-recommended government typeface.)

---

## 4. Mission & user base

**Official mission (verbatim, https://www.dol.gov/general/aboutdol):**

> "To foster, promote, and develop the welfare of the wage earners, job seekers,
> and retirees of the United States; improve working conditions; advance
> opportunities for profitable employment; and assure work-related benefits and
> rights."

**Primary constituents:** workers (wage earners), job seekers, retirees,
employers, unions, veterans, people with disabilities, federal contractors,
benefit-plan participants, and the public/researchers.

**Major sub-agencies (what the app's "programs" would actually be):**

| Agency | Serves users with |
|---|---|
| **OSHA** | Workplace safety & health standards, complaints, training |
| **WHD** (Wage & Hour) | Minimum wage, overtime, FMLA, child labor, back-pay claims |
| **ETA** (Employment & Training) | Job training, **unemployment insurance**, employment services (WIOA) |
| **OWCP** | Workers' compensation (wage replacement, medical, voc-rehab) |
| **EBSA** | Retirement/health benefit security (ERISA) |
| **OFCCP** | Equal opportunity for federal-contractor employees |
| **MSHA** | Mine safety & health |
| **VETS** | Veterans' employment & training |
| **BLS** | Labor statistics & economic data |

Sources: https://www.dol.gov/general/dol-agencies · https://www.dol.gov/agencies/eta/about/mission · https://www.dol.gov/agencies/whd/about

> **Implication for this app:** the visual re-skin is DOL, but the *content*
> (SNAP/WIC/Medicaid/LIHEAP benefits screening) is HHS-domain. A real DOL app
> screens for **unemployment insurance, wage/back-pay claims, OSHA complaints,
> WIOA job training, veterans' employment** — an ETA/WHD/OSHA-shaped catalog.

---

## 5. Required footer links

Two layers: the USWDS **Identifier** required links (every federal site) and
DOL's own **Important Website Notices** set.

### USWDS Identifier — 7 required links (https://designsystem.digital.gov/components/identifier/)
1. About the Agency
2. **Accessibility statement** → https://www.dol.gov/general/aboutdol/accessibility
3. FOIA requests → https://www.dol.gov/general/foia
4. No FEAR Act data
5. Office of the Inspector General → https://www.oig.dol.gov/
6. Performance reports
7. Privacy policy → https://www.dol.gov/general/privacynotice

### DOL "Important Website Notices" (https://www.dol.gov/general/aboutdol/website-policies)
Accessibility Statement · Disclaimers · External Linking Policy · File Formats /
Plug-Ins · FOIA · Information Quality Guidelines · No Fear Act · Plain Language ·
Privacy & Security Policies · Public Domain / Copyright / Trademark · Vulnerability
Disclosure Policy. Plus: **Notification of EEO Violations** (Cummings Act),
**OIG**, **Español**, **A-Z Index**, and standard **USA.gov / Vote.gov** cross-links.

**Required-on-all-federal-sites** (statute/EO/OMB): Accessibility (508), Privacy
(Privacy Act/E-Gov), FOIA, No FEAR Act, EEO Violations (Cummings Act), Plain
Writing Act, Information Quality Act, Vulnerability Disclosure (OMB M-20-32),
OIG presence. **DOL-specific packaging:** "Important Website Notices" hub,
"Plug-Ins Used on DOL.gov", External Linking Policy, Español portal.

---

## 6. Accessibility requirements

- **Section 508 (Rehabilitation Act)** governs federal agencies. The Revised 508
  Standards (2017 rule, effective Jan 18 2018) incorporate **WCAG 2.0 Level A &
  AA** — *not* 2.1/2.2. https://www.access-board.gov/ict/ ·
  https://www.section508.gov/manage/laws-and-policies/
- **Recommendation: build to WCAG 2.1 AA** (ideally 2.2 AA). 2.1 AA is a strict
  superset of 2.0 AA, so it satisfies 508 and matches where the law is heading.
  The federal **ICT Testing Baseline for Web v3.1** is the test process.
  https://ictbaseline.access-board.gov/web-baselines/
- **DOL's own statement:** "designed to comply with Section 508 … adheres to
  **WCAG 2.0 or higher**." Report issues to **508Matters@dol.gov** (responds in 3
  business days). https://www.dol.gov/general/aboutdol/accessibility
- **21st Century IDEA** + **OMB M-23-22** require every federal site to be: 508-
  accessible, consistently branded, plain-language, **searchable**, **HTTPS**,
  user-centered, and **mobile-first**.
  https://digital.gov/resources/delivering-digital-first-public-experience
- **DOJ ADA Title II web rule (Apr 2024, WCAG 2.1 AA)** binds **state/local**
  governments, **not** DOL — relevant only if the app is delivered to state
  workforce partners (e.g., state UI systems). https://www.ada.gov/resources/2024-03-08-web-rule/

---

## 7. Existing agency website patterns (USWDS structural must-haves)

| Pattern | What it is | Status in our app |
|---|---|---|
| **Official-site Banner** | "An official website of the United States government" + flag + expandable **"Here's how you know"** (.gov + https/lock explainer) | Partial — we have `GovBanner`, but **not** the expandable "Here's how you know" accordion. https://designsystem.digital.gov/components/banner/ |
| **Identifier** | Footer block: parent agency (+logo), domain, official statement, **7 required links** | ❌ Missing — biggest gap |
| **Footer** | Big/Medium/Slim nav + contact + "return to top" | ❌ Missing |
| **Search** | Required by IDEA/M-23-22 | ❌ Missing |
| **HTTPS / .gov / lock** | Secure-by-default, surfaced in banner | Deployment concern |

USWDS refs: Banner https://designsystem.digital.gov/components/banner/ ·
Identifier https://designsystem.digital.gov/components/identifier/ ·
Footer https://designsystem.digital.gov/components/footer/ ·
Search https://designsystem.digital.gov/components/search/

---

## Top gaps to reach a credible DOL build
1. **Identifier + footer** with the 7 required links (Accessibility, FOIA, No
   FEAR, OIG, Performance, Privacy, About) — currently absent.
2. **Expandable banner** ("Here's how you know") — upgrade the existing `GovBanner`.
3. **Reconcile `--brand-accent`** to USWDS `#d83933` (decorative) + `#8b0a03`/`#b50909` (red text).
4. **Site search.**
5. **Content** repositioned to DOL programs (UI/WHD/OSHA/WIOA/VETS) — the big one.

## Sources (primary)
USWDS tokens https://designsystem.digital.gov/design-tokens/color/theme-tokens/ ·
USWDS type https://designsystem.digital.gov/design-tokens/typesetting/font-family/ ·
DOL mission https://www.dol.gov/general/aboutdol ·
DOL accessibility https://www.dol.gov/general/aboutdol/accessibility ·
DOL website policies https://www.dol.gov/general/aboutdol/website-policies ·
Section 508 https://www.section508.gov/manage/laws-and-policies/ ·
Access Board ICT https://www.access-board.gov/ict/ ·
21st Century IDEA / M-23-22 https://digital.gov/resources/delivering-digital-first-public-experience ·
18 U.S.C. §506 https://www.law.cornell.edu/uscode/text/18/506 · §1017 https://www.law.cornell.edu/uscode/text/18/1017
