# Phase B — Dashboard shells (4 task-focused surfaces)

Phase A is done: invoices are gone, the case Financial Summary is the single money view, and Admin can Approve / Request changes with automatic student-account creation. Phase B reshapes the four dashboards so each one opens on the work that needs doing, desktop-first, with far less scrolling.

## The rule for every dashboard

Each surface is a permission-scoped view of the same case row. No dashboard keeps its own status, its own totals, or its own copy of student data.

## B1. Team dashboard (start here — it is the daily driver)

- Landing page becomes **My work**: today's appointments, cases needing action (derived from the existing task engine), cases returned by Admin with a change request, and stale cases past the SLA window.
- Case work surface stays the 5-tab case page; add the Admin change-request note as a banner at the top when the submission was returned.
- Submit-to-admin action moves onto the case page itself, disabled until the required data and documents exist.
- Keep: cases list, appointments, case detail. Merge `TeamTodayPage` into My work. Remove the separate Team analytics/spreadsheet entries from the sidebar if they duplicate the new landing (spreadsheet export stays reachable from the cases list).

## B2. Admin command center

- Landing = command center with four action queues: submissions awaiting review, unassigned cases, payments outstanding, and authorization-failure alerts. Each row deep-links into the case.
- Group the sidebar into Work (pipeline, cases, submissions, inbox), Money (financials, spreadsheet), People (team, partners, students), Setup (programs/services, settings, activity).
- Settings keeps the password gate on risky actions.

## B3. Student dashboard

- Landing = **Next steps**: current stage from the case row, the single next action, and the approved Financial Summary (paid / remaining) in ₪.
- Sections: profile, course & accommodation, insurance, documents, referrals. Approved data only; nothing internal (no commissions, no team notes, no internal timeline events).

## B4. Partner dashboard

- Landing = referred students table: name (as permitted), current stage, progress, projected value, commission and payout status. No emails, phones or documents.
- Earnings page keeps payout requests.

## Cleanup

Any page or component fully replaced by a new surface is deleted in the same step, not left orphaned.

## Technical notes

- New/edited: `src/pages/team/TeamWorkPage.tsx`, `src/pages/admin/AdminCommandCenter.tsx` (rework), `src/pages/student/StudentNextStepsPage.tsx`, `src/pages/partner/PartnerOverviewPage.tsx` (rework), sidebar config in `src/components/layout/DashboardLayout.tsx`, routes in `src/App.tsx`.
- Queues reuse the existing derivation logic (`src/components/cases/caseTasks.ts`) and the service layer in `src/services/` — no new duplicate queries.
- Money always through `formatILS`; dates and numbers `en-US` digits; every string via `t()` with matching `ar`/`en` keys; light mode only.
- Verified after each surface: typecheck, unit tests, and Playwright runs against the real routes in Arabic RTL.

## Order

B1 Team → B2 Admin → B3 Student → B4 Partner, then a check-in before Phase C (secure inbox/chat).
