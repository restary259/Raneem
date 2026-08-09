# DARB — Full System Audit & Fix (Phase 2 onward)

Phase 1 (security, identity, email routing) is implemented and deployed. This plan covers the remaining 54 points, grouped into four executable phases so each one ends with a working, verifiable system rather than a half-migrated one.

## What is already confirmed in the database

- `programs` and `accommodations` both carry `school_id`, plus `price`, `currency`, `price_tiers`, `duration` / `duration_in_months`. The school relationship exists — it is not enforced consistently in the UI.
- `case_submissions` already has `program_id`, `accommodation_id`, `insurance_id`, `program_price`, `accommodation_price`, `insurance_price`, `service_fee`, `total_paid`, `payment_confirmed`.
- Submit New Student filters accommodation by `school_id` in the client only; program filtering by school is not applied there.
- Spreadsheet Hub already defines `school` and `month` columns, but has no filter controls.

Anything not listed above is treated as unverified and gets a verification step before its fix.

## Phase 2 — Submission, case and pricing core

1. **Confirmation step.** Add a final "Review submission" step to Submit New Student showing student identity, school, program + weeks + weekly price + total, accommodation + weeks + weekly price + total, insurance, service fee and grand total, with a single Confirm & Submit action. Submit is disabled until confirmed; the step works as a full-screen sheet on mobile.
2. **School-scoped options.** Program and accommodation lists are queried by `school_id` (server-side filter, not client-side). Changing the school clears program/accommodation/insurance selections and recalculates costs.
3. **Insurance field.** Add insurance selection sourced from the `insurances` catalog, persisted to `case_submissions.insurance_id` / `insurance_price`.
4. **Weekly pricing model.** Store and display price-per-week, number of weeks and computed total separately for program and accommodation. Financial summary shows the breakdown that adds up to the case total.
5. **Service fee persistence.** Trace the fee from the form through `case_submissions.service_fee` into the case finance and summary views; fix wherever it is dropped.
6. **Submitted-case admin view.** Map the admin Submissions detail panel to the real submission record so basic info, program/accommodation and finance sections populate.
7. **Idempotency.** Server-side guard so a repeat submit of the same case/email cannot create a second case, account or invitation.

## Phase 3 — Student accounts, onboarding, finance, spreadsheets

8. **Student onboarding gate.** Track onboarding status on the profile. After activation the student is routed to a required setup flow (identity, contact, two emergency contacts, visa/passport fields) before the dashboard opens.
9. **Manual account creation** in Student Management: pick the existing case first, then create the account linked to it, with duplicate protection.
10. **Admin student account view** rebuilt into sections: Overview, Personal, Profile, Education, Accommodation, Insurance, Finance, Summary, Documents, Account actions (destructive ones behind confirmation).
11. **Collapsible profile form** in the pipeline that auto-collapses with a success state after save, and team editing that reliably persists and refetches connected views.
12. **Finance unpaid → paid** writes the real payment record/status, not a label, and invalidates the dependent queries.
13. **Spreadsheet Hub**: school and month filter controls (including "all"), column widths / wrapping / number + currency + date formatting, frozen headers, and generation strictly from live database rows so edits propagate.
14. **Exports**: Excel and PDF for every report, sharing one data layer with the on-screen sheet; audit the payout PDF for wrong/placeholder numbers.
15. **Team commission & payouts**: verify the enrolled-case commission path populates the "commission paid to team member" sheet; add the payout record/request flow if the mechanism is missing, using the existing commission rules only.
16. **Team member profile view** with real KPIs (students, active/enrolled/closed cases, commission earned / paid / pending). Same for partners.

## Phase 4 — Chat, appointments, email

17. **Mention / attach-case popup** stays open on first click (fix the click-outside / focus handling), renders results immediately, works on touch.
18. **Message editing** with an "edited" marker, authorization limited to the author.
19. **Auto-scroll** to the latest message on open, suppressed while the user is reading history.
20. **Mobile chat** does not auto-open or cover page content.
21. **Record Appointment Outcome** edge function error: reproduce, read the function logs, fix the real failure, verify the outcome reaches the case and pipeline.
22. **Create Student Account & Send Invite** from the profile block: fix the edge function error and route it through the existing invitation infrastructure only.
23. **Email trigger map**: one table of action → template → recipient → link domain, verified against the code, so no action can fire a password-reset template. Add send/bounce status visibility for the team.

## Phase 5 — End-to-end verification

Run the full 37-step journey with fresh demo data, checking the database after each significant step, and report each matrix row as PASS or UNVERIFIED with the evidence. Nothing is reported as fixed on the strength of the UI alone.

## Two decisions still open from Phase 1

- The dual-role account (`student` + `social_media_partner`) still holds both roles. Which one should it keep?
- Should the Arabic invitation copy be reworded so "set your password" no longer reads like a password reset?

## Technical notes

- Pricing stays in the database: weekly rate and week count are stored; totals are computed from them, never hardcoded in a component.
- School scoping is enforced by the query (and RLS where relevant), so a stale client cannot submit a program from another school.
- Spreadsheet and exports read the same query layer as the screen, removing the second source of truth that causes stale rows and broken references.
