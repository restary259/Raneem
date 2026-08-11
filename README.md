# درب التعليمية — Darb Agency

Study-in-Germany guidance platform for Arabic-speaking students, plus the
internal admin / team / partner / student dashboards.

**Production site**: https://darb.agency

## Tech stack

- Vite
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (database, auth, storage, edge functions)

## Local development

Requires Node.js and npm.

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
npm i
npm run dev
```

## Tests

```sh
npm run test        # unit tests (Vitest)
npx playwright test # end-to-end tests
```

## Custom domain

The site is served from `darb.agency`. All canonical URLs, sitemap entries,
email links, and structured data must use that origin.

## Google Analytics 4 (GA4)

The site tracks visitor analytics through a single consent-gated GA4
integration — no Google tag is pasted into `index.html` or individual pages.

**Measurement ID:** `G-ZTDY16W6ZL` (override per environment with the
build-time variable `VITE_GA4_MEASUREMENT_ID`; the ID is not a secret).

**Where the integration lives**

- `src/lib/analytics.ts` — the only module that talks to gtag.js. It injects
  the gtag.js `<script>` exactly once, configures the property with
  `send_page_view: false`, and exposes `initAnalytics()` / `trackPageView()`.
- `src/hooks/usePageTracking.ts` — fires a GA4 `page_view` on every
  client-side route change (wired once in `src/App.tsx`), so SPA navigations
  to public pages and the admin/team/partner/student dashboards are all
  tracked. `send_page_view: false` on config prevents gtag.js's automatic
  initial page view, so every navigation is counted exactly once.
- `src/components/common/CookieBanner.tsx` — the existing cookie-consent gate.
  GA4 loads only after the visitor chooses "Accept all" (stored under
  `darb_cookie_consent`). Accepting immediately records a page view for the
  current page; "Only necessary" keeps analytics fully unloaded.

**CSP:** the Content-Security-Policy in `vercel.json` and `public/_headers`
whitelists `www.googletagmanager.com` / `www.google-analytics.com`
(`script-src`, `img-src`) and `stats.g.doubleclick.net` (`connect-src`) for
gtag.js to load and send hits. Keep those entries if you change the CSP.

**Verify the integration**

```sh
npm test                                   # includes src/lib/analytics.test.ts
npm run dev                                # then accept cookies and watch
```

In the browser devtools, after accepting cookies check that
`https://www.googletagmanager.com/gtag/js?id=G-ZTDY16W6ZL` loads, and that
`/g/collect` network requests fire on initial load and on every navigation.
Real-time reports in GA4 should show the current page views.

