# Darb — Case-Centric Architecture Refactor (Roadmap v5)

A staged, additive refactor of the data model and code structure so the platform can grow from hundreds to tens of thousands of cases without a rewrite. No feature is removed, no table is dropped, and every phase ends with the app behaving exactly as it does today unless the phase explicitly adds something new.

## Where the project actually stands today (verified)

- 124 migrations; the schema is already largely case-centric — `cases` is referenced by `case_submissions`, `documents`, `appointments`, `rewards`, `notifications`, `visa_applications`, `commission_transactions`.
- Case status is a hardcoded TypeScript enum in `src/lib/caseStatus.ts` (9 values) plus string checks in SQL functions. There is no `pipeline_statuses` table.
- Access control is role-based only (`user_roles` + `has_role`). There is no `permissions` / `role_permissions` table.
- Finance is split across `payments`, `case_payments`, `case_service_snapshots`, `case_submissions.service_fee`, `rewards`, `payout_requests`, `transaction_log`. There are no `invoices` / `invoice_items`.
- Referral attribution is already resolved server-side and stored on the case (`partner_id`, `referred_by`, `source_attribution_method`) — but there is no `partner_links` / `partner_clicks` click tracking, and **no index on `cases.partner_id` or `cases.status`**.
- 25 frontend files call `supabase.from(...)` / `supabase.rpc(...)` directly. `src/integrations/supabase/dataService.ts` exists but is not used everywhere. There is no `src/services/` or `src/repositories/`.
- No `case_events` timeline table (only `activity_log` + `admin_audit_log`), no `analytics_daily`, no `archived` flag, no human-readable case reference.

## Guardrails for every phase

1. Additive only. New tables live alongside old ones; old tables are removed only in a separate final migration after the app is verified against the new ones.
2. No dropping/renaming a column still referenced in `src/` or `supabase/functions/`.
3. Every RLS change is listed before it is made; team members stay scoped to `cases.assigned_to = auth.uid()`; partners stay scoped to their own cases.
4. Every new table gets GRANTs + RLS in the same migration.
5. Every new UI string goes through `t()` in both `ar` and `en`; all money stays ILS (₪), all numbers/dates `en-US`.
6. After each phase: typecheck, run the vitest + Playwright suites, and a manual pass on admin / team / partner / student dashboards.

## Phases

### Phase 0 — Progress memory
Create `mem://features/architecture-refactor` holding the phase list and a status marker, and link it from `mem://index.md`. Updated at the end of every phase so a new session always knows exactly which step we are on.

### Phase 1 — Performance & housekeeping (do first, zero risk)
Indexes on `cases.status`, `cases.partner_id`, `cases.assigned_to`, `cases.student_user_id`, `profiles.email`, `documents.case_id`, `leads.source_id`. Add `cases.case_reference` (`DRB-2026-000123`, generated on insert via sequence + trigger, backfilled) and `cases.archived` / `archived_at` excluded from default lists. Pagination at 25–50 rows on the admin Students / Pipeline / Submissions tables.

### Phase 2 — Configurable pipeline statuses
New `pipeline_statuses` table (key, label_ar, label_en, sort_order, color, is_terminal, active) seeded with today's 9 statuses in today's order. `cases.status` stays `text` referencing `pipeline_statuses.key` — no data migration. `src/lib/caseStatus.ts` becomes a runtime loader with the current enum as fallback, so nothing changes visually. Admin screen under `/admin/settings` to rename, recolor, reorder and deactivate statuses.

### Phase 3 — Case timeline as an event log
New `case_events` table (case_id, event_type, actor_id, actor_role, payload jsonb, created_at) covering case_created, status_changed, document_uploaded, invoice_sent, payment_received, visa_status_changed, note_added, appointment_scheduled. Existing triggers that write `activity_log` / `admin_audit_log` also write `case_events` (the audit logs stay untouched as the compliance record). One reusable `CaseTimeline` component replaces the ad-hoc history blocks on the admin, team and student case pages.

### Phase 4 — Finance normalization
New `invoices` (case_id, status, currency ILS, issued_at, due_at, created_by) and `invoice_items` (invoice_id, description, category, amount, quantity). Totals are **never stored** — an `invoice_totals` view computes `SUM(amount * quantity)`. `payments` gains a nullable `invoice_id`; existing `case_payments` / `case_service_snapshots` keep working. Existing enrolment fees are backfilled into invoices so financial reporting and the Excel export switch to the derived totals. RLS: student sees own case's invoices, team sees assigned cases, admin sees all.

### Phase 5 — RBAC over role checks
New `permissions` (key, label, category) and `role_permissions` (role, permission_id) seeded to reproduce exactly what each role can do today — a like-for-like refactor, no behaviour change. A `usePermissions()` hook + `has_permission()` SQL function replace direct `role === 'admin'` checks in the UI. RLS policies keep `has_role` where they are already correct and adopt `has_permission` only where it is a straight substitution.

### Phase 6 — Partner link & click tracking
New `partner_links` (partner_id, code, target_path, active) and `partner_clicks` (partner_link_id, session_id, ip_hash, user_agent, clicked_at). Existing `profiles.referral_code` becomes the default link for each partner so no live link breaks. The apply flow records a click, and the resolved `partner_id` + `partner_link_id` are frozen onto the case at creation — attribution is never re-derived later.

### Phase 7 — Service / repository layer
New `src/services/` (CaseService, StudentService, InvoiceService, PartnerService, PaymentService, NotificationService, DashboardService) wrapping every Supabase read/write, built on top of the existing `dataService.ts`. Pages migrate one at a time — AdminPipelinePage and AdminFinancialsPage first — each verified before the next. Edge function logic is not touched in this phase.

### Phase 8 — Analytics rollups & archival
New `analytics_daily` (students, payments, revenue, appointments, applications) refreshed hourly by a scheduled edge function; the admin analytics page reads the rollup instead of recomputing live. Closed cases are archived rather than deleted, and archived rows drop out of the default queries added in Phase 1.

## Technical notes

- Phase order is deliberate: 1 and 2 are near-zero-risk and unlock the rest; finance (4) comes before RBAC (5) because invoice permissions are part of the seed; the service layer (7) comes after the schema settles so it is written once.
- Every phase is one migration + one code pass. Nothing in a later phase is required for an earlier one to be shippable.
- Total scope is large — expect Phases 1–3 in one working session, then 4, 5, 6, 7, 8 individually.

## Open question

Phases 4 (invoices) and 5 (RBAC) are the two that change how you work day to day. Everything else is invisible plumbing. If you want the visible value first, we can run 1 → 2 → 4 and defer 3, 5–8.
