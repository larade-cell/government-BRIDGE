---
name: gov-style
description: Format UI in the U.S. Department of Labor's official style — federal navy + red + gray, USWDS-inspired, accessible — instead of generic/"vibe-coded". Use when building or restyling any page or component, when asked to make something look polished, official, sleek, or "not vibe coded", or when adding new UI to this app so it matches the established design system.
---

Apply this app's official **Department of Labor (DOL)** visual language to any UI you build or restyle. The goal is "looks like an official DOL labor/benefits portal," not "looks AI-generated." Reuse the existing design system — do not invent new colors, fonts, radii, or one-off styles.

## Audience & voice (DOL)
This app serves DOL's constituents — **workers, employers, job seekers, and unions** — around **employment, workplace safety, wages, and benefits**. Write and lay out for that audience: plain language, action-oriented ("Check what you may be owed", "File a claim"), and trustworthy/official rather than marketing-y. Keep reading level low and tap targets large — many users are on phones, on the move, or under stress.

## First, reuse what exists
Before writing styles, lean on these (already defined in `src/styles/globals.css` and `src/components/ui`):
- Color via semantic tokens only: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary` (navy), `bg-secondary`, `bg-accent`, `border-border`, `text-destructive` (errors only), and the **DOL red accent** `bg-brand-accent` / `text-brand-accent` / `border-brand-accent`. Never hardcode hex except the navy/red backdrop values noted below.
- Layout: `.page-container` (centered max-width + responsive gutters) for public pages; `PageContainer` + `PageHeader` for dashboard pages.
- Chrome: `.brand-stripe` (thin DOL red rule at the very top of every page — already rendered once in `layout.tsx`, don't duplicate it); `.brand-gradient` (federal navy) for public/screening pages and the dashboard sidebar.
- Components: `Brand`, `Button`, `Card`/`CardHeader`/`CardContent`, `PageHeader`, `DashboardShell`, `GovBanner`, icons from `~/components/ui/icons`.
- If you need an icon, add a lucide-style stroke icon to `~/components/ui/icons.tsx` (size-4, `currentColor`) — don't pull in an icon library.

## Type
- Headings (`h1`/`h2`) render in the serif display face automatically (`font-display`, Merriweather). Use `font-display` / `font-heading` for any other headline-like text. This editorial serif is the signature of the official tone.
- Body stays sans (Public Sans, the USWDS UI typeface). Keep base text generous (the body is set to 1.0625rem/1.6 for low-literacy readability) — don't shrink it.
- Page titles: bold, `text-2xl sm:text-3xl`. Hero headlines: `font-black tracking-tight text-balance`.

## Color — navy leads, red accents, gray neutrals
DOL's identity is **navy + red + gray**. Use them in that hierarchy:
- **Federal navy** (`--primary`, #1a4480) is the dominant brand color: primary buttons, the brand mark, active nav, links-as-actions, and the `.brand-gradient` backdrop. Navy carries the weight.
- **Federal red** (`--brand-accent`, #b31942; lightened to #ff8a9b on the dark surface) is an **accent, not a primary**: the top `.brand-stripe`, eyebrow rules, and small emphasis moments. On the navy backdrop, where the deep token is low-contrast, use the bright on-navy red `#ff5d6c` (the one sanctioned red hardcode, alongside the navy hexes). **Red is a spice, not a base** — never flood large areas with it.
- **Gray** (`--muted`, `--secondary`, `--border`, `--muted-foreground`) carries surfaces, dividers, and secondary text.
- Keep `--destructive` (#b50909) for **errors only**. Don't use the brand red for error states, or the error red for emphasis — "red = emphasis" and "red = error" must stay distinguishable.
- High contrast everywhere; meet WCAG AA. The palette tokens are AA-tuned — stay on them.
- Keep keyboard focus obvious: the global `:focus-visible` ring (4px solid) is intentional — never remove outlines.

## Shape
- **Squared, structural** corners — radius is `0.25rem`. Government UIs read as structural, not playful. No decorative pills for content; rounded-full is only for small status badges and avatars.

## Signature patterns (use these instead of generic ones)
- **Red top stripe**: every page opens with the `.brand-stripe` (a thin DOL red rule above the gov banner). It's rendered once in `layout.tsx` — rely on it, don't re-add it per page.
- **Eyebrow accent (red)**: section/page titles get a left rule in the brand red — `border-l-4 border-brand-accent pl-4` (`PageHeader` already does this). On the navy backdrop use `border-l-4 border-[#ff5d6c]`.
- **Buttons**: squared, bold, high-contrast. Primary = solid **navy** (the default). Secondary = `border-2` outline. On navy use white fill (`bg-white text-[#1a4480]`) / white outline. Add `active:translate-y-px`. Reserve red for at most one high-emphasis CTA per view — navy is the default action color.
- **Cards**: `Card` with subtle border + `shadow-sm`, `hover:shadow-md` for interactive ones. A top accent (`border-t-4 border-t-primary` navy, or `border-t-brand-accent` red for a flagship task) marks primary task cards.
- **Stat tiles**: a colored rounded icon tile (`size-11 rounded-xl bg-sky-100 text-sky-700` etc.) next to a serif number — used on the dashboards. Rotate tile tones (sky/emerald/violet/indigo/amber/rose) for a row of stats.
- **Status badges**: `rounded-full px-2 py-0.5 text-xs font-semibold` with a tone pair (e.g. `bg-emerald-100 text-emerald-700` ready, `bg-amber-100 text-amber-700` pending, `bg-slate-100 text-slate-600` neutral/missing, `bg-rose-100 text-rose-700` error). Keep these consistent across the app.
- **Navy sidebar / header**: dashboards use a full-height `.brand-gradient` sidebar (brand, profile block, icon nav, sign-out); public pages use a `.brand-gradient` header.
- **Photographic hero** (marketing/landing only): full-bleed photo behind a left-weighted navy gradient overlay (`from-[#0b1b32]/95 via-[#112e51]/85 to-[#1a4480]/45`) plus a bottom fade, so white serif text stays AA-legible. The eyebrow uses the on-navy red (`border-[#ff5d6c]`). Add a small trust-signal row (free / private / official) with icons.
- **Links** in prose: underlined (`.prose-link`), USWDS link blue.

## Hard "don't"s (these read as vibe-coded or off-brand)
- ❌ Random decorative gradients, glassmorphism, neon/violet SaaS palettes, or emoji as UI chrome.
- ❌ Pill-shaped buttons/inputs, heavy drop shadows, oversized rounded corners on cards.
- ❌ Hardcoded hex colors or ad-hoc fonts instead of the tokens/faces above (the only sanctioned hardcodes are the navy backdrop hexes `#1a4480`/`#112e51`/`#0b1b32` and the on-navy red `#ff5d6c`).
- ❌ Flooding the UI with red, or using red for large fills — navy leads, red accents.
- ❌ Mixing up the two reds: `--brand-accent` = emphasis, `--destructive` = errors. Never swap them.
- ❌ Low-contrast gray-on-gray text; removing focus outlines.
- ❌ Inventing a new heading font or a third accent color.
- ❌ Inconsistent spacing — compose with the existing rhythm (`gap-*`, `PageContainer`'s `gap-8`).

## Accessibility & i18n (part of looking official)
- Semantic HTML and roles (`role="tablist"`, `aria-current`, `aria-label`); label every control. Live regions for async content; move focus on step changes; link form errors with `aria-invalid` + `aria-describedby`.
- Respect `prefers-reduced-motion` (already globally handled — keep animations subtle).
- All user-facing copy goes through i18n: add keys to **both** `src/i18n/messages/en.ts` and `es.ts`. No hardcoded English strings in user-facing UI.

## When restyling something "vibe-coded"
1. Replace ad-hoc colors with semantic tokens; replace custom fonts with the serif-display / sans system.
2. Square the corners; remove decorative gradients/shadows; apply the **red** eyebrow accent (`border-brand-accent`) to titles.
3. Swap bespoke headers for `.brand-gradient` + `Brand`, and bespoke page tops for `PageHeader`; ensure the page sits under the global `.brand-stripe`.
4. Convert metrics to stat tiles and states to the standard status badges; reserve red for accents/emphasis, navy for primary actions.
5. Verify AA contrast and visible focus; run type-check + lint before finishing.
