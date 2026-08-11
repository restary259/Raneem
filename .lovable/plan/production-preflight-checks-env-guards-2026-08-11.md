# Production preflight checks & env guards

## Already in place (verified, no work needed)

- **Supabase env guard** — `src/integrations/supabase/client.ts` already fails fast: it collects the exact missing var names, logs the descriptive `[Darb] Supabase client could not be initialized...` message, paints a visible "Configuration error" panel into `#root`, and throws.
- **`.env.example`** — exists at repo root and documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- **Security headers for Lovable hosting** — `public/_headers` already sets CSP (with `frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, Permissions-Policy and CORP/COOP/COEP.

## What this plan changes

### 1. Security headers on the Vercel path
`vercel.json` currently has rewrites + cache headers only, so a Vercel deploy gets none of the protections `public/_headers` gives the Lovable deploy. Add a global `"source": "/(.*)"` header block mirroring `public/_headers`: `Content-Security-Policy` (same directive string, including `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. Existing cache-control blocks stay untouched.

### 2. Stop leaking applicant PII to the browser console
`src/pages/ApplyPage.tsx` has 10 `console.log`/`console.error` calls (lines ~227–294) that print the full submission payload, the response body, and companion applicant data. Replace them with a small module-local `debug()` / `debugError()` helper gated on `import.meta.env.DEV`, so nothing applicant-identifying reaches a production console. Genuine failure paths keep their user-facing toast; only console output changes.

### 3. CI preflight for required build vars
Add a `Preflight: required build env vars` step to `.github/workflows/ci.yml` before the build step. It checks `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID` and fails with a list of the missing names.

Because these live in Vercel/Lovable rather than GitHub, the step reads them from repository secrets/vars and runs in **enforcing** mode only on `push` to `main`; on pull requests it warns without failing. The build step then keeps using whatever is present (unit tests continue to use the placeholders in `src/test/setup.ts`, which stay as they are).

### 4. Verification
Run `npm test` and `npm run build`, then report what changed and anything that could not be completed.

## Out of scope (noted from the audit, not changed here)

- Edge-function `?? ''` secret defaults and `push-dispatch` non-null assertions.
- Adding new domains to `ALLOWED_ORIGINS` in the shared CORS helper.
- Making lint blocking, or running Playwright E2E in CI.
- Automating `CACHE_VERSION` bumps in `public/service-worker.js`.
- Scheduling the `health-check` edge function.

Say the word if you want any of those folded in.

## Technical notes

- Files touched: `vercel.json`, `src/pages/ApplyPage.tsx`, `.github/workflows/ci.yml`.
- No database, RLS, or edge-function changes.
- The CSP string is duplicated across `public/_headers` and `vercel.json`; both must be updated together when connect/img sources change.
