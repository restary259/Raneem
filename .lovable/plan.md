# DARB — Full System Map & E2E Simulation Plan (Phase 1 scan, no changes)

## What the scan found (verified this turn)

Routing (`src/App.tsx`): 4 protected role areas behind `ProtectedRoute`
- `/admin` (admin) — command center, pipeline, cases/:id, team, programs, submissions, financials, analytics, activity, inbox, messages, settings, students, spreadsheet
- `/team` (team_member) — work, cases, cases/:id, messages, appointments, submit, students, analytics, spreadsheet, bagrut
- `/partner` (social_media_partner, ambassador) — overview, messages, students, earnings, network, performance
- `/student` (student) — next steps, messages, checklist, profile, documents, visa, refer, contacts, my-data
- Public: apply, join/:code, student-auth, activate, reset-password, unsubscribe, blog, faq, legal pages

Auth: `AuthContext` resolves role via `get_my_role()` RPC, `must_change_password` from profiles; admin passes `AdminSecurityGate`; UI permissions mirror DB via `get_my_permissions()`.

Case pipeline (`src/lib/caseStatus.ts`, `caseTransitions.ts`, table `pipeline_statuses` = 9 rows):
new → contacted → appointment_scheduled → profile_completion → payment_confirmed → submitted → enrollment_paid, plus forgotten and cancelled. Transitions are forward-only in the UI and enforced server-side by `enforce_case_stage_transition`.

Backend: 40 edge functions (account creation ×6, email ×9, push ×3, appointment outcome/reminders, admin actions, invitations). Emails: 6 auth templates (`_shared/email-templates`) + 5 transactional templates (`appointment-reminder`, `new-message`, `partner-invite`, `student-invite`, `email-test`) dispatched through `enqueue_email` → `process-email-queue` → `send-transactional-email`, logged in `email_send_log`.

Data (current live counts): 4 schools, 9 programs (all with `school_id`), 23 accommodations (all with `school_id`), 1 insurance, 3 profiles, 0 cases, 0 appointments. So school → programs and school → accommodations are both real FK relationships, and the DB is in the clean post-reset state — the simulation starts from zero cases.

Finance shape: `case_submissions` carries `school_id`, `program_id`, `accommodation_id`, `insurance_id`, weekly prices and weeks (`program_weeks`, `program_weekly_price`, `accommodation_weeks`, `accommodation_weekly_price`), `total_paid`, `remaining_balance` in EUR; agency fees live in `case_services` / `case_payments` in ILS.

## Phase A — Deliverable: system map document

Produce a written map (no code changes) covering, for each of Admin / Team / Student / Partner / Master Partner: every reachable screen, the actions available, the RPC or edge function behind each action, the tables written, and the notification/email side effects. Includes the database relationship map (student ↔ case ↔ school/program/accommodation/insurance ↔ finance ↔ documents ↔ appointments ↔ chat ↔ notifications; partner ↔ master partner ↔ recruit ↔ commission; team ↔ cases ↔ appointments ↔ payouts) and the full email inventory with trigger, recipient, template, link target and duplicate risk.

## Phase B — Deliverable: E2E simulation script

One master journey executed with Playwright against the running app, with a database assertion after every UI action. Test data is clearly prefixed (e.g. `E2E-`) and additive only; nothing existing is deleted or edited.

1. Admin: create team member, create partner, promote to master partner, verify school/program/accommodation/insurance catalogs, check invitation emails land in the send log with production URLs.
2. Partner referral: submit `/apply` through the partner link → verify case row, attribution, ref code, no duplicates.
3. Team: pick up case and walk new → contacted → appointment_scheduled (create/reschedule/outcome) → profile_completion → payment_confirmed → submitted, asserting `cases`, `case_events`, `case_submissions`, `case_services`, `case_payments`, notifications and emails at each hop, plus rejection of illegal/backward transitions at the backend.
4. School/program/accommodation coupling: choosing School A must offer only its programs and accommodations, and the stored ids must match everywhere the case is displayed.
5. Finance math: program weekly × weeks + accommodation weekly × weeks + insurance + service fee must agree across case finance, summaries, all three dashboards, spreadsheet and PDF.
6. Student: invitation email → `/activate` → password → profile, emergency contacts, visa, documents → dashboard reflects real case data, chat, notifications, appointment reminders.
7. Master partner: recruitment link → application → approval → recruit account → partner dashboard with the correct master relationship and override commission.
8. Admin close-out: enrollment, commissions, payout request and approval with the 20-day hold, spreadsheet filters (school + month), PDF exports in Arabic and English, notification and email logs.

Each step is verified at UI + database + edge-function log + email log + push log level, and repeated at mobile width and in both languages for the screens that carry RTL risk.

## Phase C — Deliverable: findings report

A prioritized list (Critical / High / Medium / Low) with, for each item: location (file, function, table), expected vs actual behaviour, impact, and the reproduction step in the journey above. Known watch-list carried into the run: `record-appointment-outcome` edge function, chat mention/case-picker popup behaviour and initial scroll position, `#REF!` and column breakage in exports, Arabic PDF numerals, activation links opening the wrong dashboard, and duplicate or misdirected invitation emails.

## Rules for this run

- Phase 1 is read-only: no code changes, no schema changes, no data deletion, no changes to master data (schools, programs, accommodations, insurances, important contacts) and no touching the three real accounts.
- Test artifacts created during the later simulation are additive, prefixed and reported so they can be removed deliberately afterwards.
- Fixes only begin after you approve the findings report, in priority order.

## Technical notes

- Playwright drives localhost with an injected session per role; every UI assertion is paired with a `supabase--read_query` check.
- Email verification reads `email_send_log` deduplicated by message id; push verification reads `push_delivery_log`.
- Authorization probes are attempt-only against test records: cross-team case reads, admin-only RPCs, role changes, other students' documents.
