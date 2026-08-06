# Security Review — Darb vs. the uploaded architecture guide

Short answer: the app is in good shape on the layers that cause real breaches. The perimeter (row-level access rules), private document storage, admin 2FA, edge-function auth checks, audit logging and account-deletion flows are all in place. What's left are hardening items, not open holes.

## What is already solid (verified this session)

- **Document storage is private.** The `student-documents` bucket is not public; access goes through per-row rules.
- **No wide-open data policies** on any table holding student, case, financial or document data.
- **Admin 2FA (TOTP) is enforced** before the admin dashboard loads, plus forced strong-password change.
- **Edge functions re-verify the caller** via a shared auth guard, and 401/403 denials are logged and surfaced in the admin Auth Failures panel.
- **Security headers are deployed**: HSTS, CSP, frame-ancestors none, nosniff, referrer policy, permissions policy.
- **Audit trail exists** (activity log, admin audit log, case events, deletion logs) and is append-only.
- **Right to erasure** is implemented (account purge + anonymization), and privacy/terms pages are published.
- **Automated scanners currently report zero critical or high findings** — only three informational warnings.

## Gaps worth closing (prioritized)

### High value
1. **File upload validation at the storage layer.** The documents bucket has no size cap and no allowed file-type list, so a client can upload any file type at any size. Add a size limit and an allow-list (PDF/JPEG/PNG) on the bucket.
2. **Input validation in edge functions.** None of the functions validate request bodies against a schema. Add zod schemas to the functions that write data (student creation, appointment outcomes, payouts, notifications) so malformed or hostile payloads are rejected before touching the database.
3. **Locked-down CORS.** Every edge function currently answers requests from any origin. Restrict to the live domain plus the preview domain.

### Medium value
4. **Document retention policy.** Passport and visa scans are kept indefinitely. Define a retention window (e.g. delete or anonymize documents 3 years after a case closes) and automate it on a schedule.
5. **Internal configuration tables readable by every signed-in account.** The permissions, role-permissions, checklist and pipeline-status tables are readable by students and partners. Restrict to staff roles.
6. **Anomaly alerting on document access.** Logging exists, but nothing alerts when one staff account reads an unusual number of student documents in a short window. Add a threshold check to the existing auth-failure monitoring panel.

### Lower value
7. **CSP still allows inline scripts** (`script-src 'unsafe-inline'`), which weakens XSS protection. Removing it requires checking that no inline script is needed at runtime.
8. **Incident response document** — a short written runbook (detect, contain, assess, notify within 72 hours, remediate) stored where it's reachable even if the platform is down.
9. **Backup restore test** — confirm a database restore actually works once, before you need it.

## Not applicable / already handled differently

- Field-level encryption of passport numbers: platform-level encryption at rest already applies; adding column encryption would break search and admin review flows. Worth revisiting only if a client demands it contractually.
- Service-role key exposure: the key is never available to the frontend on this stack, and no client file references it.

## Suggested order

Items 1-3 in one pass (storage limits, schema validation, CORS), then 4-6, then the documentation and testing items.

## Technical notes

- Storage limits: update the `student-documents` bucket with `file_size_limit` and `allowed_mime_types`.
- Validation: add a shared zod schema module under `supabase/functions/_shared/` and wire it into each writing function's handler before any database call.
- CORS: replace the wildcard in the shared CORS header block with an allow-list checked against the request `Origin`.
- Retention: a scheduled edge function that soft-deletes documents on closed/archived cases past the retention window, writing an entry to the deletion log.
- Config tables: replace the read-for-any-signed-in-user rules on `permissions`, `role_permissions`, `checklist_items` and `pipeline_statuses` with staff-role checks (students still need checklist items — scope that one to their own case instead).
