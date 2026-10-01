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

## i18n
- Keys in en + ar + he, both `public/locales` and bundled `src/locales` (must be identical). Hebrew values must be translated (brand = דארב).
- A `t()` key must never resolve to an object; `nav.*` lives in `dashboard`.
- `src/lib/i18nRuntime.test.ts` initializes the real i18n instance (loading, interpolation, he->en fallback, dir) — keep it green on library upgrades.

## Tests / UI
- Supabase client mocks must expose every surface the module touches at import (e.g. `auth.onAuthStateChange`); `rpc()` mocks must be chainable thenables.
- Grids containing `truncate` text need a base `grid-cols-1` and `min-w-0` items; `DialogContent` must stay exported.

- Never put `script-src` in the root document meta CSP: TanStack hydrates from an inline `$_TSR` script and a nonce-less meta policy blanks the app.
- Google Business Profile calls go only through the built-in connector gateway from admin-gated server functions (`googleBusinessConnection.functions.ts`); never store Google tokens ourselves.
