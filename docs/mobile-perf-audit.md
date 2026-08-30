# Mobile performance audit — measurement only (2026-08-30)

No code was changed. All numbers below come from a production build (`npm run build`) served by
`vite preview` on `127.0.0.1:4173`, measured in headless Chromium under mobile emulation:
390×844, DPR 3, touch, **4× CPU throttle**, **Slow-4G** (150 ms RTT, 1.6 Mbps down).

Harnesses used:
- `e2e/mobile_perf_audit.py` — warm-navigation metrics + scroll frame timing.
- `/tmp/browser/perf/cold.py` — one fresh browser context per route (cold cache), LCP **element**
  capture, per-type transfer bytes.
- `/tmp/browser/perf/res.py` — full resource waterfall + rendered-vs-natural image sizes.
- `/tmp/browser/perf/prof.py` — V8 CPU profile, self-time attributed per script chunk.
- `/tmp/browser/perf/detail.py` — long-task timeline, load event, first-vs-second visit (SW).

## Coverage / limitation

Public routes were measured fully. For dashboards, only a **team** session could be minted
(`team@gmail.com`) and that account is flagged `must_change_password`, so every `/team/*` route
renders the forced-password screen rather than the real dashboard. Mints for admin and for a
non-flagged team account were declined during the run, so `/admin/*`, `/student/*`, `/partner/*`,
`/agent/*` are reported **unauthenticated** (they redirect to `/student-auth`). Those rows measure
the app's boot cost, not the dashboards' render cost. Admin routes additionally sit behind
`AdminSecurityGate` (AAL2/TOTP), which a minted session cannot satisfy.

---

## 1. Per-route metrics (cold cache, first visit)

| Route | State | TTFB | FCP | **LCP** | CLS | Blocking (TBT-like) | Longest task | JS kB | Img kB | JSON kB | Total kB | Reqs | DOM nodes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | public | 11 | 1376 | **5008** | 0 | 659 | 275 | 273 | **2816** | 106 | 3222 | 48 | 554 |
| `/apply` | public | 6 | 1656 | 1728 | 0 | 148 | 116 | 274 | 417 | 106 | 825 | 32 | 168 |
| `/services` | public | 9 | 1612 | **5796** | 0 | 344 | 296 | 330 | 432 | 106 | 896 | 52 | 666 |
| `/faq` | public | 6 | 1604 | **5212** | 0 | 192 | 156 | 279 | 432 | 106 | 845 | 40 | 345 |
| `/team`, `/team/catalog` | authed, password gate | ~130 | 1240–1656 | 4936–5200 | 0 | 239–359 | — | 257 | 417 | 106 | 808 | 24 | 89 |
| `/admin` → `/student-auth` | unauth redirect | — | 1344 | 6868 | 0 | 602 | — | 257 | 417 | 106 | 808 | 39 | 169 |
| `/student` → `/student-auth` | unauth redirect | — | 1228 | 6712 | 0 | 397 | — | 257 | 417 | 106 | 808 | 39 | 169 |
| `/partner` → `/student-auth` | unauth redirect | — | 1248 | 6332 | 0 | 394 | — | 257 | 417 | 106 | 808 | 39 | 169 |
| `/agent` → `/student-auth` | unauth redirect | — | 1160 | 6300 | 0 | 236 | — | 257 | 417 | 106 | 808 | 39 | 169 |

Times in ms. `Blocking` = Σ(longtask − 50 ms), the harness's TBT proxy.

LCP elements measured (not guessed):
- `/` → `<img>` `/lovable-uploads/hero-poster.webp` (401 kB, natural 1600×907, rendered 390×844).
- `/apply` → `<img>` `78047579-…png` (the logo).
- `/services` → `<p class="text-lg text-muted-foreground">` (text).
- `/faq` → `<h1>` (text).
- `/student-auth` → auth card `<div>` (text/box).

**Scroll (frame timing, slow full-height scroll + fling):** median 16.6–16.8 ms, p95 16.7–16.8 ms,
0 janky frames on every public route (`/services` had 1 dropped frame out of 142). Scroll smoothness
is **not** what costs the score. Scroll-reset check returned `top: 0` before and after navigation on
public routes (document scroller).

**Repeat visit:** the service worker caches everything — visit 2 of `/` transferred **2 kB** and
fired `load` at 1641 ms vs 2838 ms cold. The 68/100 field score reflects the cold first visit only.

---

## 2. Root causes, ranked by score impact

### R1 — Homepage ships 2.8 MB of images; the LCP image alone is 401 kB (LCP 5.0 s)
`public/lovable-uploads` is 17 MB. On `/`:
- `hero-poster.webp` = **401 kB**, natural 1600×907, displayed at 390×844 CSS px. It is preloaded
  with `fetchpriority="high"` (`index.html:38`) and still starts at 219 ms but only finishes at
  **4935 ms** — it is bandwidth-bound, not discovery-bound. Preload cannot fix a file this large.
- The student gallery downloads 12 more webp files (68–376 kB each, naturals up to 1200×1600)
  rendered at **279×372 CSS px**. Two are `loading="eager"` + `fetchpriority="high"`, so they
  compete with the LCP image; the marquee also renders duplicate `<img>` nodes measuring 0×0 that
  still download.
- Measured: 2816 kB of images vs 273 kB of JS on the homepage. Images are ~87 % of the page weight.

Fix would touch: image assets in `public/lovable-uploads` (resize + re-encode to the rendered size,
add AVIF), `src/components/landing/Hero.tsx`, `src/components/landing/StudentGallery.tsx`
(eager/priority flags, duplicated marquee nodes).

### R2 — Every route blocks first paint on 12 sequential locale JSON fetches (106 kB)
`src/i18n.ts` registers 13 namespaces with `useSuspense: true` and an HTTP backend
(`/locales/{{lng}}/{{ns}}.json`). Measured on `/student-auth`: locale fetches start at **2818 ms**
(after the JS graph parses) and the last one finishes at **4027 ms** — `dashboard.json` alone is
59 kB and is fetched even on public pages and on the login screen, where it is never used. Nothing
renders until they resolve, which is why routes whose LCP is *text* land at 5.2–6.9 s while TTFB is
under 12 ms.

Fix would touch: `src/i18n.ts` (per-route namespace loading or bundling `common` inline),
`public/locales/ar/dashboard.json` (split), possibly a preload hint in `index.html`.

### R3 — The hero preload fires on routes that never show the hero
`index.html:38` preloads `hero-poster.webp` unconditionally. Measured on `/student-auth`: 401 kB
downloaded (`start=207 → end=4719`) for an image that page never renders, on a 1.6 Mbps link. That
alone pushes the login/dashboard boot LCP into the 6.3–6.9 s range.

Fix would touch: `index.html` (scope the preload) or move it to a route-level preload.

### R4 — ~1.1 s of main-thread script execution during boot (blocking 236–659 ms)
CPU profile of `/` (4× throttle), self time per chunk:
`vendor-react` 501 ms, app `index-*.js` 371 ms, `vendor-i18n` 191 ms, `vendor-utils` 41 ms,
`vendor-supabase` 34 ms. Long-task timeline on `/`: 8 tasks (107, 148, 56, 82, **247**, 89, 82,
104 ms). The initial JS payload itself is modest (257–330 kB transferred) — the cost is evaluation
under CPU throttling, concentrated in React + the app entry (`index-BpZWTXMJ.js`, 435 kB raw /
131 kB gz).

Fix would touch: `src/App.tsx` / `src/main.tsx` boot path, whatever is eagerly imported into the
entry chunk (auth context, providers, PWA/service-worker registration, notification setup).

### R5 — 10 Google Font families requested in one stylesheet
`index.html:34` requests Tajawal, IBM Plex Sans Arabic, Noto Sans Arabic, Noto Sans, Inter,
Source Sans 3, IBM Plex Sans, Source Serif 4, Merriweather, IBM Plex Mono — with `media="print"` +
onload swap (correctly non-render-blocking) and `display=swap`. In this sandbox the CSS resolved
(4 kB) but `fonts.gstatic.com` woff2 files did not transfer, so **font bytes could not be measured
here** — on the real network this is the one remaining third-party dependency in the critical path
and a FOUT source. CLS measured 0, so the swap is not currently shifting layout.

Fix would touch: `index.html` (drop unused families, self-host the 2 Arabic families actually used
for first paint).

### R6 — The PWA splash screen is tied to the `load` event
`index.html:200-208` removes `#pwa-loading` only on `window.load`. On `/` with lazy gallery images
still streaming, `load` measured at 2838 ms cold (and up to ~16 s when the full image set is forced
in). Until then the user sees the splash rather than content — this is what the field score
perceives as a slow start even after FCP at 1.4 s.

Fix would touch: `index.html` splash script (hide on first React paint instead of `load`).

### R7 — One 156 kB stylesheet is render-blocking
`dist/assets/index-DF4CQlWQ.css` is a single 156 kB blocking `<link>` (24 kB transferred, gz).
Small in bytes but it gates first paint together with the module graph. Low impact relative to
R1–R4.

### Verified NOT a problem
- **Route code-splitting works.** `dist/index.html` modulepreloads only `vendor-utils`,
  `vendor-react`, `vendor-i18n`, `vendor-supabase`. `vendor-charts` (390 kB) and `vendor-pdf`
  (1.74 MB) do **not** load on boot on any measured route — the `vite.config.ts` grouping fix holds.
  Heavy route chunks stay isolated (`PartnershipPage` 610 kB, `EducationalProgramsPage` 308 kB,
  `LebenslaufBuilder` 91 kB load only on their own routes).
- **CLS is 0.000 on every measured route.** No layout-shift contribution to the score, despite
  images having no `width`/`height` attributes (aspect-ratio containers are doing the job).
- **Scroll performance is clean** at p95 ≈ 16.7 ms with 0 janky frames on all public routes.

---

## 3. Cross-reference with the earlier scroll fix plan (D1–D6)

| ID | Defect | Score-relevant? | Evidence |
|---|---|---|---|
| D1 | Scroll position not reset on navigation | No | Measured `top: 0` before/after navigation; a UX defect only, and dashboards couldn't be exercised authenticated. |
| D2 | Nested scrollers missing `overscroll-behavior` | No | Already applied globally in `src/index.css:236-241`; no metric effect. |
| D3 | Body scroll not locked behind overlays | No | Affects INP/feel, not LCP/TBT/CLS as measured. |
| D4 | No list virtualization | Unproven here | Public DOM counts are small (168–666 nodes); the login shell is 169. Dashboard lists could not be measured authenticated — this stays open. |
| D5 | Missing touch momentum | No | Present in `src/index.css:236-241`; frame timings show no jank. |
| D6 | Unverified surfaces | Unproven | Same authentication limitation. |

None of D1–D6 explains the 68/100. The score is dominated by R1 (image weight), R2 (i18n fetch
waterfall), R3 (misplaced preload) and R4 (boot scripting).

## 4. Estimated ranking

1. **R1** — homepage LCP 5.0 s / 2.8 MB images.
2. **R2** — 1.2 s i18n fetch waterfall gating text LCP on every route (5.2–6.9 s).
3. **R3** — 401 kB hero preload on non-hero routes.
4. **R4** — ~1.1 s boot scripting, 236–659 ms blocking.
5. **R6** — splash tied to `load`.
6. **R5** — 10 font families / third-party critical path (unmeasured bytes here).
7. **R7** — 156 kB blocking CSS.

To close the loop on dashboards, a session for a non-`must_change_password` team account (and, for
admin, a TOTP-satisfied session) is required; those rows can then be re-measured with the same
harnesses.
