# DARB × Google Business — Production Readiness Report

Generated at Phase 10 (final gate). Status vocabulary is deliberately
`PASS` / `NOT COVERED` — never a fabricated score. **PASS means a concrete,
reproducible check ran**; `NOT COVERED` means it needs a live Google account or
infrastructure this repository's offline harness cannot exercise, and must be run
during staging / pilot.

## What "verified" means here

- **Behaviour harness** (offline, real Postgres replay):
  `supabase/diagnostics/office_google_phase9_behavior_verify.sql` (62 checks) and
  `office_google_phase10_behavior_verify.sql` (46 checks).
- **Deploy verifier** (read-only, asserts structure + grants):
  `office_google_phase9_deploy_verify.sql` (123 checks) and
  `office_google_phase10_deploy_verify.sql` (49 checks).
- **Unit tests**: `src/lib/googleBusiness*.test.ts`, `googlePermissions.test.ts`,
  `googlePubSubAuth.test.ts`.
- **Typecheck**: `npx tsc --noEmit`.

## Scorecard

| Area | Status | Evidence |
|---|---|---|
| Authentication | PASS | `is_admin_session` requires admin role **and** AAL2; authz checks in harness |
| Authorization | PASS | `authorize_google_office_action` single entry point; `googlePermissions.test.ts`; harness role matrix |
| RLS | PASS | deploy verifier table-by-table RLS + grants; office isolation in behavior harness |
| Secrets | PASS | no literals/logged/URL secrets (repo scan); server-env only; docs/google-business/secret-rotation.md |
| OAuth | PASS (repo) / NOT COVERED (live) | no token custody in repo; live consent/reconnect is staging |
| Pub/Sub | PASS | webhook OIDC verification (`googlePubSubAuth.test.ts`); thin capture-then-queue harness |
| API security | PASS | centralized gateway; no direct Google host calls; connector custody |
| Events | PASS | idempotency, redelivery re-route, unknown-location/account parking, coalescing |
| Reviews | PASS (repo) | reply/lifecycle tests; live fetch is staging |
| Profile | PASS (repo) / NOT COVERED (live) | change-request flow; live update is staging |
| Media | PASS (repo) / NOT COVERED (live) | upload validation tests; live publish is staging |
| Posts | PASS (repo) / NOT COVERED (live) | draft/publish validation tests; live publish is staging |
| Performance | PASS (repo) / NOT COVERED (live) | export tests; live metrics are daily |
| Notifications | PASS | role-aware audience, per-event dedupe, office-scoped RLS |
| Data integrity | PASS | `audit_google_business_integrity` + DB triggers reject bad writes |
| Concurrency | PASS | lock-token claim, `FOR UPDATE SKIP LOCKED`, unique active-job index |
| Recovery | PASS | stale-job recovery harness; dead-letter retry re-routes |
| Emergency controls | PASS | global/office/read/write kill switches enforced at DB + worker |
| Observability | PASS | `admin_google_integration_health`, event timeline, dead letters, sync jobs |
| Accessibility / RTL / Mobile | NOT COVERED | needs the browser matrix; see checklist below |

## Release blockers — all clear

Cross-office access, token/secret exposure, missing RLS, privilege escalation,
duplicate Google mapping, unauthenticated webhook, duplicate event effects,
broken OAuth refresh, destructive migration risk, unrecoverable sync jobs.

Each is blocked by a check in the harnesses above (and by DB triggers for
mapping/operator/review integrity).

## Not covered by the offline harness (run at staging / pilot)

These require a live `info@darb.agency` connection, real infrastructure or a
browser. They are **not** claimed as verified:

- [ ] Live Google API reads/writes (reviews, profile, media, posts, performance)
- [ ] Live Pub/Sub delivery (real push through Google Cloud)
- [ ] Real OAuth consent, reconnect, and old-client rotation
- [ ] Backup → restore → integrity re-check
- [ ] Load / spike / sync-storm at 10/50/100 offices
- [ ] Google API outage, Supabase outage, worker crash under real conditions
- [ ] Browser matrix (Chrome/Edge/Firefox/Safari), mobile 390/430/768
- [ ] Arabic/Hebrew RTL layout + chart accessibility
- [ ] PWA cache safety (no OAuth/private/admin caching)
- [ ] Staged rollout error/latency review at each percentage

## Go-live sequence

1. Freeze Google code · 2. Run both deploy verifiers (must be ALL CHECKS PASSED)
· 3. Run both behavior harnesses · 4. `npx tsc --noEmit` + `npm test` + build
· 5. Staging: complete the not-covered list · 6. Pilot office: full checklist
· 7. Production smoke test · 8. Gradual rollout (1 → 2–3 → 25% → 50% → 100%),
verifying errors/latency/sync/permissions/reviews/events after each stage.

## Production smoke test (after deploy)

Admin → Google Integration (health) → pilot office → Reviews, Profile, Photos,
Posts, Insights. Then one safe **read** operation. Do not run destructive tests
against live profiles (no deleting real replies/photos/posts, no address edits).
