# DARB — Color Consistency, SEO & Arabic/English Content

## 1. One orange, one source of truth

Today the Student Login button hardcodes Tailwind `orange-500` / `hover:orange-600`, while the design token `--brand` is gold. That is why the hero CTA and the homepage stats look different from the login button.

Fix:
- Retune `--brand` in `src/index.css` to the exact Student Login orange (light and dark blocks), with a foreground that stays readable (white on orange, contrast checked).
- Replace the hardcoded orange classes in `src/components/landing/Header.tsx` and `MobileNav.tsx` with the token (`bg-brand text-brand-foreground hover:bg-brand/90`), so login, hover and active states come from one place.
- "Book a Free Consultation" (`Hero.tsx`) already uses `variant="accent"` → `bg-brand`, so it inherits the new orange automatically.
- Homepage stats — Satisfied Students / Educational Partners / Countries Worldwide — switch to `text-brand` in `Hero.tsx` (already) and `AboutCustom.tsx` (currently `text-primary`).

## 2. Sitewide color audit (public pages only)

Sweep every public page and landing component for hardcoded color utilities (`orange-*`, `bg-[#...]`, `text-white`, `blue-*`, etc.) and map each one to the right semantic token:
- Brand CTA and key stats → `--brand`.
- Primary/secondary buttons, links, nav, footer, cards, icons, badges, forms → existing `primary` / `secondary` / `muted` tokens.
- Status colors (success / warning / error / info) stay intentional and untouched.

Dashboards are out of scope for this pass. Result reviewed on desktop and mobile widths via the live preview.

## 3. Blog: infrastructure + seed articles

New in-code content system (no backend):
- `src/content/blog/` — one typed TS module per article (slug, title/description AR + EN, publishedAt, updatedAt, sources, body sections).
- Routes `/blog` (index, filterable by category: قبل السفر / الجامعة / المال / الحياة في ألمانيا) and `/blog/:slug`, lazy-loaded like other public routes.
- Full RTL Arabic + English rendering driven by the current i18n language, reusing the existing landing header/footer and typography.
- Per-article `SEOHead` with canonical `https://darb.agency/blog/<slug>`, Article + BreadcrumbList JSON-LD, "آخر تحديث" date visible on the page, and a sources block with official links.
- Internal links from each article to the relevant DARB pages (services, cost calculator, FAQ, contact) — a few meaningful links, not a link farm.

Seed articles (4), each researched against official sources and every external link opened and verified before it ships:
1. تكلفة المعيشة في ألمانيا للطلاب + الحساب المغلق (sources: Auswärtiges Amt, DAAD).
2. شروط القبول والتقديم للجامعات الألمانية و Studienkolleg (sources: DAAD, anabin/uni-assist).
3. التأمين الصحي للطلاب في ألمانيا (sources: official public insurers, DAAD).
4. قائمة تجهيز الطالب قبل السفر + أول أسبوع في ألمانيا (Anmeldung, بنك, شريحة, مواصلات — sources: official city portals, Deutsche Bahn).

Every figure carries its year and its source. Anything not verifiable from an official source is omitted rather than guessed. No guarantees of admission, visa, housing or outcomes anywhere in the copy.

## 4. Audience terminology

Arabic copy across public pages and articles uses عرب الداخل / عرب 48 / الطلاب العرب naturally. Any wording that doesn't match how this audience identifies itself is replaced. Public content stays Arabic + English only — no Hebrew.

## 5. Technical SEO pass

- Verify each public route has a unique title, meta description, single H1 and correct heading order; fix duplicates and thin metadata.
- Confirm canonical and `og:url` self-reference each route on `https://darb.agency` (no lovable.app, preview or localhost URLs anywhere).
- Add the blog index and every article to `public/sitemap.xml`; keep `robots.txt` blocking only private routes.
- Check image `alt` text on public pages, and internal-link the blog from the homepage/resources hub.

## Technical notes

- Token change is CSS-variable only; Tailwind config already maps `brand` → `hsl(var(--brand))`, so no config edit is needed.
- Dashboards use `--primary` (neutral near-white in dark mode) and are unaffected by the brand retune.
- Crawlers execute JS for `SEOHead`, so blog metadata is indexable; social-preview crawlers still read the static `index.html` head — accurate per-article previews would need SSR ([what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start)).

## Verification

Typecheck + existing 71 tests, plus a Playwright pass screenshotting the homepage, blog index and one article at desktop and mobile widths to confirm color consistency and layout.
