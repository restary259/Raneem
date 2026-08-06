# Phase 3 — Case timeline (event log)

Roadmap v5, Phase 3. Every case gets a single, readable history: who did what and when — status moves, documents, payments, appointments, notes — shown the same way to admins, team members and students (with students seeing only the safe subset).

## Why now

Today a case's history is scattered: status changes land in `activity_log`, admin actions land in `admin_audit_log`, appointment outcomes and intake notes live on their own rows, and nothing on the case page shows them together. `case_events` does not exist yet (verified). The security/compliance log (`admin_audit_log`) stays exactly as-is; the new table is the user-facing story of the case.

## What gets built

**1. `case_events` table**
- Fields: case_id, event_type, actor_id, actor_role, payload (jsonb), created_at.
- Event types: case_created, status_changed, document_uploaded, invoice_sent, payment_received, note_added, appointment_scheduled, appointment_outcome, visa_status_changed, student_account_created.
- Access: admins see all; team members see events for cases assigned to them; students see events on their own case, excluding internal-only ones (internal notes, commission/financial detail). Only the database and edge functions write events — nobody can hand-forge history from the browser.

**2. Automatic event capture (no manual bookkeeping)**
- Case created, status changed, archived — database triggers on `cases`.
- Document uploaded — trigger on `documents`.
- Appointment scheduled / outcome recorded — trigger on `appointments`.
- Payment confirmed, enrollment paid — trigger on `case_submissions`.
- Notes — written when a note is saved on the case page.
- Existing paths that already log to `admin_audit_log` keep doing so; they gain a case event only where it is meaningful to a human reading the case.
- Backfill: existing `activity_log` status-change rows and case creation dates are seeded into `case_events` so old cases aren't blank.

**3. `CaseTimeline` component**
- One reusable component: vertical timeline, icon + colour per event type, actor name, relative time ("منذ ساعتين") plus exact date on hover, expandable detail for events with a payload.
- Filter chips by event category, "load more" paging (25 at a time).
- Fully translated (ar + en) via `t()`, ASCII digits, RTL-correct.

**4. Where it appears**
- Team/admin case detail page (`src/pages/team/CaseDetailPage.tsx`) — new "السجل الزمني / Timeline" section replacing the ad-hoc history bits.
- Student dashboard — read-only timeline of their own visible events, so they can see progress without asking.

## Technical notes

- Migration: `CREATE TABLE public.case_events` → GRANTs (`authenticated` select, `service_role` all) → RLS enable → policies (admin / assigned team member / own student, insert restricted to definer functions) → indexes on `(case_id, created_at desc)` and `event_type`.
- A `SECURITY DEFINER` helper `log_case_event(case_id, event_type, payload)` used by all triggers and by the app for notes; `actor_id` always forced to `auth.uid()` (same anti-spoofing rule as `log_activity`).
- New files: `src/hooks/useCaseEvents.ts`, `src/components/cases/CaseTimeline.tsx`, `src/components/cases/caseEventMeta.ts` (icon/colour/label map).
- Additive only: `activity_log` and `admin_audit_log` untouched, no existing column changed.
- Verification: typecheck, unit tests, seed a status change on a real case and confirm it appears in the timeline for admin and is correctly hidden/shown for a student.

## Not in this phase

Invoices (Phase 4), RBAC permissions (Phase 5), partner click tracking (Phase 6), service layer (Phase 7).
