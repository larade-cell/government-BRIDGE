---
name: gov-style
description: Format UI government-style (USWDS-inspired, official, accessible) instead of generic/"vibe-coded". Use when building or restyling any page or component, when asked to make something look polished, official, sleek, or "not vibe coded", or when adding new UI to this app so it matches the established design system.
---

Apply this app's official, government-grade visual language (modeled on the U.S. Web Design System) to any UI you build or restyle. The goal is "looks like an official benefits portal," not "looks AI-generated." Reuse the existing design system — do not invent new colors, fonts, radii, or one-off styles.

## First, reuse what exists
Before writing styles, lean on these (already defined in `src/styles/globals.css` and `src/components/ui`):
- Color via semantic tokens only: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `bg-secondary`, `bg-accent`, `border-border`, `text-destructive`. Never hardcode hex except the brand navy backdrop noted below.
- Layout: `.page-container` (centered max-width + responsive gutters) for public pages; `PageContainer` + `PageHeader` for dashboard pages.
- Navy backdrop: `.brand-gradient` (federal navy) for public/screening pages and the dashboard sidebar.
- Components: `Brand`, `Button`, `Card`/`CardHeader`/`CardContent`, `PageHeader`, `DashboardShell`, icons from `~/components/ui/icons`.
- If you need an icon, add a lucide-style stroke icon to `~/components/ui/icons.tsx` (size-4, `currentColor`) — don't pull in an icon library.

## Type
- Headings (`h1`/`h2`) render in the serif display face automatically (`font-display`, Merriweather). Use `font-display` / `font-heading` for any other headline-like text. This editorial serif is the signature of the official tone.
- Body stays sans (Public Sans). Keep base text generous (the body is set to 1.0625rem/1.6 for low-literacy readability) — don't shrink it.
- Page titles: bold, `text-2xl sm:text-3xl`. Hero headlines: `font-black tracking-tight text-balance`.

## Shape & color
- **Squared, structural** corners — radius is `0.25rem`. Government UIs read as structural, not playful. No decorative pills for content; rounded-full is only for small status badges and avatars.
- **Federal navy** (`--primary`, #1a4480) drives primary actions, the brand mark, active nav, and accents — one official identity across light app and dark pages.
- High contrast everywhere; meet WCAG AA. The palette tokens are already AA-tuned — stay on them.
- Keep keyboard focus obvious: the global `:focus-visible` ring (4px solid) is intentional — never remove outlines.

## Signature patterns (use these instead of generic ones)
- **Eyebrow accent**: section/page titles get a left rule — `border-l-4 border-primary pl-4` (white on navy: `border-white/70`). `PageHeader` already does this.
- **Buttons**: squared, bold, high-contrast. Primary = solid; secondary = `border-2` outline. On navy use white fill (`bg-white text-[#1a4480]`) / white outline. Add `active:translate-y-px`.
- **Cards**: `Card` with subtle border + `shadow-sm`, `hover:shadow-md` for interactive ones. A top accent (`border-t-4 border-t-primary`) marks primary task cards.
- **Stat tiles**: a colored rounded icon tile (`size-11 rounded-xl bg-sky-100 text-sky-700` etc.) next to a serif number — used on the dashboards. Rotate tile tones (sky/emerald/violet/indigo/amber/rose) for a row of stats.
- **Status badges**: `rounded-full px-2 py-0.5 text-xs font-semibold` with a tone pair (e.g. `bg-emerald-100 text-emerald-700` ready, `bg-amber-100 text-amber-700` pending, `bg-slate-100 text-slate-600` neutral/missing, `bg-rose-100 text-rose-700` error). Keep these consistent across the app.
- **Navy sidebar / header**: dashboards use a full-height `.brand-gradient` sidebar (brand, profile block, icon nav, sign-out); public pages use a `.brand-gradient` header.
- **Photographic hero** (marketing/landing only): full-bleed photo behind a left-weighted navy gradient overlay (`from-[#0b1b32]/95 via-[#112e51]/85 to-[#1a4480]/45`) plus a bottom fade, so white serif text stays AA-legible. Add a small trust-signal row (free / private / bilingual) with icons.
- **Links** in prose: underlined (`.prose-link`), USWDS link blue.

## Hard "don't"s (these read as vibe-coded)
- ❌ Random decorative gradients, glassmorphism, neon/violet SaaS palettes, or emoji as UI chrome.
- ❌ Pill-shaped buttons/inputs, heavy drop shadows, oversized rounded corners on cards.
- ❌ Hardcoded hex colors or ad-hoc fonts instead of the tokens/faces above.
- ❌ Low-contrast gray-on-gray text; removing focus outlines.
- ❌ Inventing a new heading font or a second accent color.
- ❌ Inconsistent spacing — compose with the existing rhythm (`gap-*`, `PageContainer`'s `gap-8`).

## Accessibility & i18n (part of looking official)
- Semantic HTML and roles (`role="tablist"`, `aria-current`, `aria-label`); label every control.
- Respect `prefers-reduced-motion` (already globally handled — keep animations subtle).
- All user-facing copy goes through i18n: add keys to **both** `src/i18n/messages/en.ts` and `es.ts`. No hardcoded English strings in resident-facing UI.

## When restyling something "vibe-coded"
1. Replace ad-hoc colors with semantic tokens; replace custom fonts with the serif-display / sans system.
2. Square the corners; remove decorative gradients/shadows; apply the eyebrow accent to titles.
3. Swap bespoke headers for `.brand-gradient` + `Brand`, and bespoke page tops for `PageHeader`.
4. Convert metrics to stat tiles and states to the standard status badges.
5. Verify AA contrast and visible focus; run type-check + lint before finishing.
