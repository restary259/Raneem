# Production data reset — keep admin + Naif's case + full catalog

## What I verified in the live database (not assumptions)

- **18 accounts.** Exactly one is real: `ranimdwahde3@gmail.com` (ADMINISTRATION, role `admin`, created 2026-03-05). The other 17 were all created 2026-08-21 → 2026-08-27 and are obvious test accounts (`team@gmail.com`, `agent@gmail.com`, `partner@gmail.com`, `student@gmail.com`, `ammbasseder1@gmail.com`, `darbsocial27@gmail.com`, etc.).
- **18 cases.** Naif is `DRB-2026-000111` (`f29ccd89-…`), status `new`, created 2026-08-29, no assigned team member, no partner, no student account. The other 17 are test cases ("agent apply form", "agent ammbassder 2", "test Gmeel 11", …), almost all forced to `enrollment_paid`.
- **Naif's case has almost no dependencies:** 1 lead row, 1 case event, 1 notification. No submission, services, payments, invoices, appointments, documents, messages, rewards.
- **Test-generated volume to clear:** 574 notifications, 538 case events, 306 email logs, 146 case services, 38 rewards, 23 invitations, 18 appointments, 17 payments/submissions/leads, 16 invoices, 15 financial snapshots, 4215 auth-failure log rows, 1747 push delivery rows, plus commission overrides, agent relationships, partner links, direct threads, payout request, referral.
- **Catalog is separate and stays untouched:** 4 schools, 15 programs, 40 accommodations, 2 insurances, 20 majors, 10 service catalog rows, master services, pipeline statuses, permissions, eligibility config, checklist templates, important contacts, platform settings.
- **Confirmed UI bug (item 8):** in the week view of Team → Appointments the day columns use physical `border-r` with `last:border-r-0`. Under Arabic RTL the physical right border lands on the wrong side, so the Friday/Saturday boundary reads as missing. Real defect, not imagined.

## Approach

Data-only cleanup. No schema redesign, no RLS rewrites, no logic changes, no migration/edge-function deletions. Deletion is done by an explicit keep-list (admin id + Naif case id + Naif lead id), never by a blanket `TRUNCATE`.

### Phase 1 — Snapshot and safety net
Export the full pre-delete row inventory and the exact keep-set to `/mnt/documents/` so there is a record of what existed before anything is removed.

### Phase 2 — Delete test case data (child → parent)
Everything scoped to the 17 test case ids: case events, submissions, services, service snapshots, financial snapshots, finance confirmations, payments, payment proofs, invoices, messages + reads, message mutes, documents + versions, student checklist rows, visa applications + field values, appointments + reminders, case events, then the case rows and their 16 test leads. Order follows the real FK map (e.g. `case_payment_proofs.uploaded_by` is `ON DELETE RESTRICT`, so proofs go before profiles).

### Phase 3 — Delete money/attribution artefacts of test data
Rewards, commission transactions, commission rate history, case financial snapshots, payout requests, referrals, partner links + clicks, partner recruit applications, agent relationships, and the per-account commission override rows (agent, agent self-referral, partner, team member, student referral). Global default rates in `platform_settings` are **not** touched.

### Phase 4 — Delete the 17 test accounts completely
For each test user id: direct threads + participants + messages, notifications + preferences + push subscriptions + push delivery log, consent records, data requests, active sessions, admin security sessions, invitations (as inviter and as invitee), email send log / send state / unsubscribe tokens / suppressed emails for their addresses, activity log and audit rows tied to them, `user_roles`, then `profiles`, then the `auth.users` rows (which cascades `auth.identities`, sessions and MFA factors). Deleting the auth row — not anonymising it, which is what `purge-account` does — is what makes the Gmail addresses reusable.

### Phase 5 — Reset operational noise
Clear `auth_failure_log`, `login_attempts`, `ai_chat_logs`, `push_delivery_log`, `email_send_log`, `activity_log`, `admin_audit_log`, `transaction_log`, `deletion_logs`, `case_events` orphans, and any notification not belonging to the admin or Naif's case. Dashboards then read a genuine zero state.

### Phase 6 — Verification sweep
- Row counts before/after per table, with the keep-set proven present.
- Orphan scan: every FK column re-checked for dangling ids (cases → profiles, rewards → cases, submissions → cases, invitations → profiles, notifications → cases, etc.).
- `auth.users` vs `profiles` vs `user_roles` three-way reconciliation (no side has an extra row).
- Email reuse test through the existing `check-email-availability` function for a sample of the deleted addresses.
- Admin login + admin dashboard, and Naif's case detail page, exercised in a headless browser session; console and network errors captured.
- Per-role walkthrough of the dashboards that survive (admin, team, and the empty-state paths for agent/partner/student) looking for wrong counts, broken filters, bad empty states, failed requests.

### Phase 7 — UI fixes
- Week view dividers: switch the day header and hour-slot cells to logical `border-e` and keep the trailing edge, so Friday/Saturday are separated in both LTR and RTL.
- Any additional layout/empty-state defects the Phase 6 sweep proves (each one reported with evidence before it is changed).

## Technical notes

- All destructive SQL runs as data statements (`DELETE`), scoped by explicit id lists derived at run time from the keep-set, executed in FK-safe order.
- `auth.users` deletion is the one auth-schema write, required for email reuse; nothing else in `auth` is modified.
- Guard triggers (`restrict_profiles_write`, `guard_case_attribution_lock`, `enforce_case_stage_transition`, …) are left in place; deletes do not trip them.
- Storage objects for deleted cases (`student-documents`, `chat-attachments`) are removed alongside their metadata rows so no private files are stranded.
- Nothing in the catalog, pricing, service bundles, insurances, blocked-account options, roles, permissions or RLS policies is changed.

## Confirmations before I run the destructive phases

1. `darbsocial27@gmail.com` is listed in the codebase as the public Darb privacy/contact address, but here it exists as a **test partner account** ("Agentpartnerinvite"). I plan to delete that account so the address is reusable — the address itself keeps working as an inbox.
2. All 17 non-admin accounts go, including the three team members and both students. Naif's case stays unassigned (it currently has no assignee anyway) until you assign a real team member.
