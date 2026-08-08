# Darb — Final E2E Production Audit & Fix Run

Goal: drive the real application (not a code read) from `/apply` through to an
enrolled student, verifying every step against the database, backend functions,
auth state and email log — then fix what fails and re-run the flow.

Confirmed inputs: team login `team@gmail.com`, demo data is created and kept,
real emails may be sent, fixes go all the way through UI/UX in this run.

---

## Phase 0 — Test harness

- Set up a Playwright driver under `/tmp/browser/` that can log in as admin,
  team and student against the running app, take screenshots at each step, and
  capture console + network errors.
- Snapshot the DB before the run (case/profile/user counts) so demo records are
  identifiable afterwards.

## Phase 1 — Apply and attribution

- Submit three real applications through `/apply`: Adam Khalil, Lina Mansour,
  Omar Haddad, filling every field that actually exists on the form.
- One submitted through a partner referral link to exercise attribution.
- Verify in the database: case row created, correct source/ref code, correct
  partner linkage, no duplicate lead/case/profile, timestamps and assignment.
- Verify the referral/discount relationship renders correctly in the partner and
  admin views, and that commission math follows the existing flat-fee model.

## Phase 2 — Pipeline walk

Move each case through NEW → CONTACTED → APPOINTMENT → PROFILE COMPLETION →
PAYMENT → SUBMITTED → ENROLLED, checking after every transition:

- Status persisted in `cases`, event written to `case_events`, UI reflects it
  after a hard refresh.
- Appointment create/edit/cancel actually persists, with the right assignee and
  scheduled time.
- Profile completion writes to one source of truth — the same values must read
  back identically in team, admin and student views.
- Financial summary reflects services, insurance, accommodation and payments
  attached to the case.
- Illegal transitions (skipping stages, moving backwards) are rejected by the
  backend, not just hidden in the UI.

## Phase 3 — Submission, student account and email

Submission test case uses `tsukuyomidomain00@gmail.com`.

- Team submits; confirm admin receives it and status becomes Submitted.
- Confirm the auth user is actually created, linked to the case, with no
  duplicate account, and the profile is pre-filled from case data.
- Confirm the setup email was queued and sent (checked in the email send log,
  deduplicated by message id) with a correct production URL — no localhost.
- Log in as the student and verify the dashboard shows the case's real data.
- Then move to ENROLLED and verify all three dashboards and the timeline update.

## Phase 4 — Team dashboard and security

- Real login as the team account; walk cases, pipeline, appointments, chat,
  notifications, submission, logout.
- Probe authorization directly against the backend, not the UI: access another
  team member's case by ID, call admin-only RPCs and edge functions, attempt to
  change roles/permissions, attempt to read other students' data.
- Repeat spot-checks for the student and partner roles.

## Phase 5 — Chat simulation

- Run a real team ↔ admin conversation, then refresh and confirm persistence,
  sender/recipient, timestamps, read state, badges and notifications.
- Verify permission rules at the backend layer: admin↔team allowed, team↔team
  blocked by default.

## Phase 6 — Notification badge

The badge is reported invisible; the cause is not yet confirmed. Diagnose it by
screenshotting the header at desktop, tablet and mobile with zero, one and many
unread items, inspecting computed styles, stacking context and any clipping
ancestor — then fix the underlying cause rather than recoloring it.

## Phase 7 — UI/UX, translations, responsive

- Screenshot every stage and audit contrast, spacing, hierarchy, empty/loading/
  error states, and duplicated cards, tabs, status chips and buttons.
- Remove genuinely redundant UI; keep anything that carries function.
- Run the flow in Arabic and English: hunt raw translation keys, wrong-language
  strings, RTL icon/layout breaks and overflow.
- Re-check the critical screens at tablet and mobile widths.

## Phase 8 — Error and edge cases

Missing fields, invalid and duplicate email, duplicate submission, double-click
submit, refresh mid-submission, failed uploads, failed chat send, failed
appointment save, unauthorized access — each must land on a clear user-facing
state, never a blank screen or a false success.

## Phase 9 — Fixes

Fix in priority order, tracing each bug from UI → hook → function → database →
RLS before changing anything:

1. Blockers: broken auth, case creation, pipeline, student account, email, RLS
   holes, data loss, UI/backend mismatch.
2. Core logic: pipeline rules, submission, account creation, notifications,
   payments, referral integrity.
3. UI/UX: badge visibility, layout, hierarchy, redundant components.
4. Translations and RTL.
5. Code quality: dead code, duplicate implementations, stale architecture.

## Phase 10 — Regression and report

Re-run the whole flow end to end on a fresh demo case, then deliver the report
in the requested format: E2E result, per-stage flow table, security, backend,
UI/UX, translations, performance, code quality, fixes applied, remaining
issues, and the production checklist.

---

## Technical notes

- Browser automation drives the real app on localhost with an injected session;
  every UI claim is paired with a database or edge-function-log check.
- Email verification reads the send log deduplicated by message id, since one
  email writes several rows.
- Demo records are kept and clearly named so they can be located later; nothing
  existing is deleted.
- Authorization probes are read/attempt-only against demo records — no
  destructive testing on real data.
