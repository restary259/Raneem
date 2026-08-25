# Edge function audit — findings and fixes

All 41 backend functions are deployed (no missing endpoints). I probed every one live and cross-checked callers, config, and logs. One function is genuinely broken; the rest are healthy or intentionally locked down.

## Confirmed broken: `selective-delete`

Every request to it — including the browser's CORS preflight — returns HTTP 500. Live log:

```text
ReferenceError: corsHeaders is not defined
    at json (.../selective-delete/index.ts)
```

Cause: the module-level `json()` helper reads `corsHeaders`, but `corsHeaders` is declared **inside** the request handler, so it is out of scope. Since every response path goes through `json()`, nothing works. The admin "selective delete" action in `AdminStudentsPage` (the only caller) has therefore never succeeded.

Fix: pass the request-scoped `corsHeaders` into `json()` (or build them inside the helper from the request). No behavior, auth, or delete-logic change — only response construction.

## Verified healthy (no change)

- 39 functions respond correctly to a live probe; none return 404 (all deployed).
- `process-email-queue` returns 401 on preflight because `verify_jwt = true` at the gateway. It is only invoked server-side by the pg_cron dispatcher with the vault service-role key, so this is correct.
- `handle-email-suppression` returns 405 on preflight — it is a provider webhook, not browser-called. Correct.
- Functions with no in-app caller are intentional entry points: `auth-email-hook`, `auth-guard` (auth hooks), `send-appointment-reminders`, `admin-weekly-digest`, `push-dispatch`, `process-email-queue` (cron), `health-check`, `preview-transactional-email` (ops/diagnostics).

## Config hygiene (small, safe)

`supabase/config.toml` declares two functions that no longer exist in the repo: `create-influencer` and `create-student-account`. These entries are dead and misleading. Remove them.

Functions present in the repo but absent from `config.toml` (`change-own-password`, `notify-new-message`, `admin-early-release`, `create-student-standalone`, `get-team-members`, `purge-account`, `reset-student-password`, `record-appointment-outcome`, `send-custom-notification`, and others) all enforce auth internally via `requireAuth`, so no config additions are needed.

## Steps

1. Fix the `corsHeaders` scope bug in `supabase/functions/selective-delete/index.ts`.
2. Remove the two stale function blocks from `supabase/config.toml`.
3. Re-probe `selective-delete` after redeploy and confirm preflight returns 204 and an unauthenticated POST returns 401 (not 500).

## Out of scope

No changes to auth gating, RLS, cron schedules, email flows, or any other function's logic.
