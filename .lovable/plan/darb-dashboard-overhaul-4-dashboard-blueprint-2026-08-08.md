# DARB — Dashboard Overhaul (4-dashboard blueprint)

Rebuild the platform around one rule: **the Case is the single source of truth**, and every dashboard is a permission-scoped view of it. Delivered in phases, core first.

## Phase A — Case, services and Financial Summary (first delivery)

### A1. Financial Summary replaces invoices
- Remove the Invoices tab and all invoice navigation from the case view.
- Financial Summary becomes the one financial surface, built from case services + payments:
  service/provider, price + currency (₪), discount, paid, outstanding, status, refunds, referral discount, commission line.
- Attaching a service automatically creates its financial line — no second place to enter money.
- Delete the invoice tables and their sync trigger, plus `CaseInvoices.tsx`, `useInvoices.ts`, `InvoiceService.ts` and the invoice branches in payments/permissions.
  Current data: 4 invoices, 2 line items, 0 payments linked to an invoice — nothing of value is lost, and the services/payments they were generated from stay.

### A2. Services on the case
- Team attaches only services that Admin has configured (language course, accommodation, insurance, visa support, other).
- SIM card, bank account and DB ticket are **not** modelled as case services — they are covered by the service fee, per your call. They appear as informational items only where already present.
- Language-school master data (schools, course types/levels, seasonal prices, dates, accommodation options) stays admin-managed; Team picks, never free-types prices.

### A3. Submit → Approve → automatic student account
- Team submits a completed case; the case locks for Team editing and moves to Admin review.
- Admin sees a review screen (case data, services, payment, required documents) with **Approve** or **Request changes** (returns the case to Team with a reason on the timeline).
- On approval the backend: finds an existing student account for the case email and links it, or creates one and sends the invitation email. Never duplicates the student, services, documents or financial data — the Student Dashboard reads the same case.

### A4. Pipeline integrity
- One status value, server-enforced: New → Contacted → Appointment → Profile → Services → Payment → Submitted → Approved/Enrolled.
- No dashboard keeps its own competing status; KPIs, partner view and student status all derive from the case row.

## Phase B — Dashboard shells (right after A)

Each dashboard reduced to task-focused, desktop-first pages with less scrolling:
- **Admin**: command center (cases + pipeline, schools/services, financial summary, team & managers, partners & commissions, inbox, settings with password-gated risky actions).
- **Team**: assigned cases, case work surface, appointments, submit-to-admin. No access to anything outside assignment.
- **Student**: profile, course, accommodation, insurance, financial summary, documents, next steps — approved data only, zero internal info.
- **Partner**: referred students, current stage, pipeline progress, projected value, commission + status. No private student data.

Obsolete pages and duplicate components removed as each surface is replaced.

## Phase C — Secure Inbox / chat (full build)

- New conversation + message tables with RLS: Admin ↔ Team, Manager ↔ all Team, **Team-to-Team blocked by default** with an admin-granted exception flag.
- Text, photos and documents via private storage; threads optionally linked to a case and surfaced on that case.
- Unread counts and notifications; authorization enforced in the backend, never in the UI alone.

## Phase D — AI guardrails and QA

- "Choose your subject" AI: uses configured school/course data, labels guidance vs verified fact, never invents schools/prices/requirements, never promises eligibility.
- Per-user rate limit, token/credit ceiling, usage logging and abuse protection, with admin-visible usage.
- Full end-to-end QA across all four dashboards (Arabic RTL + English, loading/empty/error states), plus automated tests for the case lifecycle and the approve → student-account flow.

## Technical notes

- Migrations: drop `invoices`/`invoice_items` and `sync_case_service_invoice_line()`, clear `case_payments.invoice_id`; add case submission review fields (reviewed_by, reviewed_at, review_note); add `conversations` / `conversation_participants` / `messages` (+ attachments) with GRANTs and RLS in Phase C; add `ai_usage_limits` in Phase D.
- Approval + account creation runs in one edge function (extending `create-student-from-case`) so linking-vs-creating and the invitation email are atomic and server-authorised.
- Financial Summary reads `case_services` + `case_payments` through a single service module; every figure formatted in ₪ with en-US digits.
- All strings via `t()` with matching `ar`/`en` keys; light mode only; deleted code is removed, not commented out.

## Order of work

A1 → A2 → A3 → A4 → B → C → D, with a check-in after Phase A and after Phase B.
