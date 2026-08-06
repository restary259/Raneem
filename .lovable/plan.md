# Authorization-failure monitoring + E2E CI

Two additions: (1) catch and surface repeated permission failures (RLS denials, 401/403 from backend functions) so regressions are noticed the day they ship, and (2) an automated end-to-end test that runs in CI on every push.

## 1. Capture authorization failures

New table `auth_failure_log` records every denied request:

- who (user id, role, anonymous flag)
- what (source: `rls` or `edge_function`, the table/function name, the operation)
- outcome (HTTP status 401/403 or the Postgres error code)
- when, plus a short redacted error message and the page path

Writes are allowed for any signed-in or anonymous caller (it is a failure receipt, not sensitive data), reads are admin-only, and no one can update or delete rows.

## 2. Report failures from both sides

- **Frontend**: a small shared helper wraps backend responses. When a query comes back with a permission error (`42501`, `PGRST301`) or a function call returns 401/403, it writes one row to `auth_failure_log` and shows the existing generic error toast. It is wired into the shared data layer (`dataService`) and the function-invoke call sites, not sprinkled per component.
- **Backend functions**: the shared `requireAuth` guard already returns 401/403 in one place — it will log the denial there, so every guarded function is covered automatically.

Logging never blocks the user action and never throws.

## 3. Admin alerting

- New **Auth Failures** section inside the existing Security & Audit tab: recent denials, grouped by function/table with counts for the last 24h and 7d, filterable by source and status.
- A red banner appears at the top of the admin dashboard when a spike is detected — default threshold **10 or more failures on the same table/function within 1 hour**, or any failure on a table that had none in the previous 7 days (a likely new regression).
- The existing weekly digest function gains an authorization-failure summary, and a spike also creates an in-app notification for every admin so it is not missed between digests.

## 4. E2E test in CI

- Add Vitest + Playwright with a `test` and `test:e2e` script.
- E2E spec covers the public path that needs no credentials: landing page loads, navigation to the apply page, apply-form validation, and a check that protected routes (`/admin`, `/team-dashboard`) redirect to sign-in instead of rendering.
- Add an authorization-regression spec: unauthenticated calls to guarded backend functions must return 401, and an anonymous read of a protected table must be denied. This is the test that fails loudly if a policy is loosened.
- New GitHub Actions workflow runs typecheck, unit tests, build, then Playwright against the built preview server on every push and pull request. The existing deploy workflow is left as-is.

## Technical notes

- Migration: `create table public.auth_failure_log`, followed by `GRANT INSERT` to `anon`+`authenticated`, `GRANT SELECT` to `authenticated` (admin-gated by policy), `GRANT ALL` to `service_role`, then RLS enable and policies (`INSERT with check (true)`, `SELECT using has_role(auth.uid(),'admin')`, no update/delete policies). Index on `(created_at desc)` and `(target, created_at desc)`.
- Spike detection via a `SECURITY DEFINER` function `get_auth_failure_spikes(p_window interval, p_threshold int)` returning grouped counts; `EXECUTE` revoked from `anon`.
- Frontend helper `src/lib/authFailureLog.ts`; admin UI `src/components/admin/AuthFailuresPanel.tsx` mounted in `SecurityAuditPanel.tsx`; banner in `src/components/admin/AdminOverview.tsx`.
- Backend logging inside `supabase/functions/_shared/auth.ts` using the service-role client already available there.
- Test config: `vitest.config.ts`, `playwright.config.ts`, specs under `e2e/`, workflow at `.github/workflows/ci.yml`. Playwright uses the publishable key only — no secrets in CI.
- All new user-facing strings go through `t()` with keys added to both `ar` and `en` locale files.
