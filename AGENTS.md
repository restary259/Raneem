# DARB — Agent Rules (index)

Full history and per-feature rationale: `docs/agent-notes.md` (read the relevant section before touching that area).

## Gates
- `npm run build` is `vite build` only (no typecheck). Always run `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo $?` — never pipe tsc into `head` before `$?`.
- `bun.lock` is the only lockfile; dependency changes must regenerate it in the same commit.
- CI order is Lint -> Tests -> Typecheck -> Build; fix the first failing step, later ones may hide more errors.

## Money / workflow (server is authoritative)
- Totals from `get_case_financials`; commissions only via `record_case_commission` (idempotent, additive agent share, no master partner). Never recompute money in the frontend.
- Case stages enforced by `enforce_case_stage_transition`; visa is NOT a case status.
- Clear `must_change_password` only via `clear_must_change_password()`.
- Migrations are MANUAL DEPLOY; new migrations need unique timestamps newer than any function they redefine.

## Security
- Guard irreversible actions at the RPC (lock + idempotency), not only the UI.
- Prefer scoped SECURITY DEFINER RPCs over widening RLS; never expose views/tables revoked from `authenticated`.
- Never launder query errors into `[]`; failed reads must stay distinguishable from empty.

## Brand
- Darb gold is `#F9B115` (= `41.1 95% 52.9%`). It is the ONLY yellow accent: the `--highlight` CTA/booking pill, `--darb-yellow` (spectrum strip / arch), `--tint-yellow` category tint, and the gold rule in emails, invoices and corporate exports. Do not reintroduce `#FFC107` or `#F4C84A`.

## i18n
- Keys in en + ar + he, both `public/locales` and bundled `src/locales` (must be identical). Hebrew values must be translated (brand = דארב).
- A `t()` key must never resolve to an object; `nav.*` lives in `dashboard`.
- `src/lib/i18nRuntime.test.ts` initializes the real i18n instance (loading, interpolation, he->en fallback, dir) — keep it green on library upgrades.

## Routing / URL state
- The router uses `parseSearchCompat`/`stringifySearchCompat` (`src/lib/searchParams.ts`) wired in BOTH `src/router.tsx` and the test `MemoryRouter` (`src/lib/router-compat.tsx`). TanStack's default JSON serializer would turn `page=2` into `page=%222%22`; never remove these or numeric/plain query params silently break.
- The compat `useLocation().search` already includes the leading `?` (from TanStack `searchStr`) — do not prepend another.
- List/filter/page state that a user expects to return to lives in the URL (`useSearchParams`), not `useState`. High-level hub tabs (`TabHub historyMode="push"`) are real history entries; lightweight filters/paging/search use `replace: true` so Back returns to the list, not through every keystroke.

## Tests / UI
- Supabase client mocks must expose every surface the module touches at import (e.g. `auth.onAuthStateChange`); `rpc()` mocks must be chainable thenables.
- Grids containing `truncate` text need a base `grid-cols-1` and `min-w-0` items; `DialogContent` must stay exported.

- Never put `script-src` in the root document meta CSP: TanStack hydrates from an inline `$_TSR` script and a nonce-less meta policy blanks the app.
- Google Business Profile calls go only through the built-in connector gateway from admin-gated server functions (`googleBusinessConnection.functions.ts`); never store Google tokens ourselves.
- Active destination cities are controlled by `ACTIVE_DESTINATION_CITIES` in `src/data/educationalDestinations.ts`; hide cities there, never delete their data. Why: Darb may reopen other cities later.
- Internal background logs (net._http_response, cron.job_run_details) keep 7 days via the daily `cleanup-internal-logs` cron job; never slow `voice-call-cleanup`. Why: limits storage growth without affecting live calls.
- Team Students tab scoping lives only in `src/services/teamStudentsScope.ts` (admin: all students; team member: `created_by = me` or case assigned to me), with explicit filters, never RLS alone; only admins may override `created_by` on manual creation. Why: prevents one team member's students leaking to another (covered by `teamStudentsScope.test.ts`).
- A school's catalog photo opens `schools.photo_link` when set (e.g. HORIZONTE's Google Maps walkthrough). Only http(s) links are honored (`schoolPhotoLink()` in `src/lib/catalogDisplay.ts`); the SchoolCard photo `<a>` stops propagation so it never also selects the school.
- `20261005190000_school_photo_links.sql` owns `photo_link` ONLY, never `photos`. It shares timestamp `20261005190000` with the HORIZONTE housing-photos migration, so alphabetical order runs it last; writing `photos` there silently clobbers `school/hero.jpg`. Guarded by `src/lib/schoolCatalogPhotos.test.ts`.
- The repair for a database that already recorded `20261005190000` (in-place edits do not re-run) is `20261005200000_reassert_horizonte_hero_photo.sql`: it restores `school/hero.jpg` only when `photos` is exactly the clobbered accommodation set, so a legitimate admin edit is never overwritten.
- Catalog photos are authored in `src/data/schoolCatalog/*.json` and compiled into `20260820000000_school_catalog_seed.sql` by `node gen-seed.mjs` (keep its output byte-identical). Every school and accommodation needs ≥1 photo whose file exists under `public/`; `schoolCatalogPhotos.test.ts` enforces it.
