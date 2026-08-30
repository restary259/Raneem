# Mobile performance audit (measurement only)

Goal: explain the 68/100 mobile score with measured evidence, no code changes. Output is a findings report written to `docs/mobile-perf-audit.md` plus a summary in chat.

Note: running a production build, serving it, and writing the report file are state-changing steps, so they start once this plan is approved.

## 1. Measurement run

- `npm run build`, then serve `dist` locally on 127.0.0.1:4173.
- Run `e2e/mobile_perf_audit.py` (already set to 390x844, DPR 3, touch, 4x CPU throttle, Slow-4G, with LCP/CLS/long-task observers and scroll frame timing) against:
  - Public: `/`, `/apply`, `/services`, `/faq`
  - Admin: `/admin`, `/admin/pipeline`, `/admin/students`, `/admin/financials`, `/admin/members`, `/admin/commission`
  - Team: `/team`, `/team/cases`, `/team/catalog`, `/team/analytics`
  - Student: `/student`, `/student/documents`, `/student/fees`, `/student/messages`
  - Partner: `/partner`, `/partner/students`, `/partner/earnings`
  - Agent: `/agent`, `/agent/network`, `/agent/students`
- Authenticated routes use a minted preview session (`lovable auth-session`) per role where one exists; routes that can't be authenticated are reported as unauthenticated and excluded from scoring rather than guessed.
- Per route captured: FCP, LCP, CLS, DCL, long-task count, blocking ms, JS transferred, request count, DOM nodes, and scroll frame median/p95/max plus dropped/janky frames for a slow scroll and a fling.

## 2. Diagnosis on top of the harness numbers

- **LCP element per route**: capture the actual LCP entry `element`/`url` and its request timing, then attribute the delay to TTFB, render-blocking CSS/JS, the image itself, or font swap. Includes checking whether `/lovable-uploads/hero-poster.webp` (preloaded in `index.html`) is really the homepage LCP and whether dashboards have a text LCP gated behind lazy chunks + i18n suspense.
- **TBT / long tasks**: attribute long tasks to script URLs via a CDP performance trace, mapped back to the Rollup chunk names in `vite.config.ts` (`vendor-react`, `vendor-supabase`, `vendor-charts`, `vendor-pdf`, `vendor-i18n`).
- **Bundle audit**: list all emitted chunks by size, and verify route lazy-splitting actually holds by diffing the network waterfall per route against the chunk map — specifically whether `vendor-charts`/`vendor-pdf` load on boot, and whether the "vendor-utils" grouping fixed the earlier preload leak.
- **Images**: inventory `public/lovable-uploads` and `src/assets` for byte size vs. rendered size, format (webp/avif vs. png/jpg), presence of `width`/`height` or aspect-ratio, and `loading`/`fetchpriority` attributes; correlate with the measured CLS per route.
- **Fonts**: the Google Fonts link in `index.html` requests 10 families with `media="print"` + onload swap. Measure whether that produces a late swap (FOUT/CLS) and quantify the transferred font bytes and how many families are actually used on a first paint.
- **Render-blocking**: check `index.html` head order, the inline JSON-LD, `src/index.css` plus the five imported stylesheets, and the i18n HTTP backend fetch (`/locales/*.json`) which suspends the whole app before first paint.
- **Service worker**: `public/service-worker.js` is registered; record whether the first visit costs extra work or the second visit is cached, since the real-world score is a cold first load.

## 3. Cross-reference D1–D6

For each defect in the earlier scroll fix plan, state from measurement whether it affects the score (TBT/CLS/INP) or only feels wrong: D1 scroll reset, D2 scroll chaining, D3 body lock, D4 no virtualization (DOM node counts per route give the answer), D5 momentum, D6 unverified surfaces. No fixes applied.

## 4. Deliverable

`docs/mobile-perf-audit.md` containing:
- Per-route metric table (score-relevant: LCP, TBT/blocking, CLS, JS KB, DOM nodes, scroll p95).
- Root causes ranked by estimated score impact, each backed by a measured number and a file reference.
- A short "what a fix would touch" note per cause, for a follow-up plan — no code changes in this pass.
