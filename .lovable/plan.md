# Mobile performance fixes (no behaviour change)

Goal: cut the cold-load cost measured in `docs/mobile-perf-audit.md` without touching any business
logic, data flow, RLS, commissions, or routing behaviour. Every change is asset-level or
loading-strategy-level. The `team3@gmail.com` session is used to measure the real dashboards
(previously blocked by a forced-password screen), so dashboard routes get before/after numbers too.

## What gets changed

### F1 — Shrink the image payload (biggest win: homepage LCP 5.0 s, 2.8 MB of images)
- Re-encode `public/lovable-uploads/hero-poster.webp` from 1600×907 / 401 kB down to the size it is
  actually displayed at on mobile, and add an AVIF sibling. Same filename for the webp so nothing
  that references it changes.
- Re-encode the student-gallery photos (currently 1200×1600, 68–376 kB each, rendered at 279×372).
- No markup restructuring: only `loading` / `fetchpriority` / `decoding` attributes are corrected in
  `src/components/landing/Hero.tsx` and `src/components/landing/StudentGallery.tsx` so that only the
  true LCP image is eager and the marquee's duplicated off-screen copies stop downloading eagerly.
- Rendered layout, aspect ratios and animation stay identical (CLS is already 0.000 and must stay 0).

### F2 — Stop blocking first paint on 12 locale files (106 kB, finishes at ~4.0 s)
- `src/i18n.ts` currently preloads 13 namespaces on every route. Reduce the boot set to the
  namespaces a first paint actually needs, and let the rest load on demand through the existing
  HTTP backend. `t()` usage, key names, fallbacks and the `i18nKeys` parity guard are untouched —
  only *when* a namespace is fetched changes.
- `dashboard.json` (59 kB) stops being fetched on public and auth pages.
- Keep the top-level `Suspense` in `src/main.tsx` exactly as is (deployment-safety invariant).

### F3 — Scope the hero preload
`index.html` preloads the 401 kB hero on every route, including `/student-auth` where it is never
rendered. Restrict it so only the landing route pays for it.

### F4 — Splash screen should hide on first paint, not `window.load`
`index.html` removes `#pwa-loading` on `window.load`, which waits for streaming images. Hide it when
React has painted instead, keeping the same markup and the same fallback timeout so nothing can get
stuck behind it.

### F5 — Font families
`index.html` requests 10 Google Font families in one stylesheet. Drop the families that are not used
in the rendered UI, keeping the Arabic/Latin faces the design system actually references. No CSS
token or `font-family` declaration changes — only the fetched list narrows.

Not in scope: the ~1.1 s of boot scripting (R4), the 156 kB stylesheet (R7), and the D1–D6 scroll
items. Those need structural changes and are left for a separate pass.

## Verification

1. `npm run build` and `npx vitest run` must both be green (i18n parity guard included).
2. Re-run the same harnesses used for the audit (390×844, DPR 3, 4× CPU, Slow-4G, cold cache) on the
   public routes and, signed in as `team3@gmail.com`, on `/team`, `/team/cases`, `/team/catalog`,
   `/team/analytics` — capturing FCP, LCP + LCP element, CLS, blocking ms, bytes by type.
3. Functional smoke pass in the browser while signed in: Arabic and English rendering on public
   pages and dashboard pages (no missing-key placeholders), language switch, navigation between
   dashboard routes, and one case-detail open — confirming the namespace change did not strip any
   translation.
4. Append a "After" section to `docs/mobile-perf-audit.md` with the before/after table.

## Technical notes

- Image re-encode is done with `sharp` at build-prep time and the smaller files are committed; no
  new runtime dependency and no `vite-imagetools` plugin is added.
- Namespace loading uses i18next's existing lazy backend — no provider or hook API changes, so no
  component needs editing for F2.
- CLS is currently 0.000 on every route; the after-run must still read 0.000 or the image change is
  reverted.
