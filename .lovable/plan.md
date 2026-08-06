# Darb — Platform Optimization Blueprint (v4)

Scope: full-platform audit + phased implementation roadmap. Findings below are grounded in reads of the current code and database; anything not yet verified is marked **[unverified]** and gets a verification step before any fix.

---

## Verified findings

### F1 — /faq has no navigation entry (confirmed)
`src/components/landing/DesktopNav.tsx` and `MobileNav.tsx` list Home, About, Services, Majors, Quiz, Resources, Contact, and a "More" group (Educational destinations, Partnership, Broadcast). There is no FAQ link anywhere in the header. Only the footer links to it.
Impact: the highest-intent SEO page is invisible to site visitors.
Fix: add FAQ to the "More" dropdown (desktop) and the More accordion (mobile), plus a link from Resources.

### F2 — Admin "Submitted" commission preview does not match what actually gets paid (confirmed, financial)
`AdminSubmissionsPage.loadSplitPreview` fetches **all** rows from `partner_commission_overrides` and adds every partner that "qualifies" by source rule into the preview total. The database function `record_case_commission` (verified in schema) pays **only** the partner linked to the case (`partner_id`, else `referred_by`).
Impact: the admin sees an inflated partner payout and an understated platform revenue before confirming enrollment payment — the number on screen is not the number that gets written.
Fix: rewrite the preview to resolve the single linked partner exactly as the RPC does.

Secondary issue in the same file: a wasted `profiles` query against a hardcoded zero-UUID, then a second profiles query for real names.

### F3 — Appointment scheduling is a raw `datetime-local` input (confirmed)
`src/components/team/AppointmentSchedulerModal.tsx` is one `<Input type="datetime-local">`, a numeric duration box, notes — all labels hardcoded English, error toasts raw `err.message`. `ScheduleDialog.tsx` and `RescheduleDialog.tsx` duplicate this pattern.
Impact: slow booking, no view of the team member's existing appointments, double-booking possible, untranslated UI.

### F4 — Finance test data still present (confirmed)
`payout_requests` has exactly one row: `partner@gmail.com`, ₪1,000, `status = rejected` but `paid_at = 2026-03-10` and a linked reward id that no longer resolves (rewards table is empty). `transaction_log` has 1 matching orphan row.
Impact: a rejected request carrying a paid timestamp makes every finance total and tax report untrustworthy; the UI renders it as "مدفوع".
Fix: delete the payout request + its transaction_log row, and add a DB-level guard so `paid_at` can only be set when status is `paid`.

### F5 — Untranslated strings / raw error messages in the team workflow (confirmed)
`AppointmentSchedulerModal` (all strings), `TeamStudentProfilePage` ("Service Fee", untagged `toLocaleString()`), `CaseDetailPage` (untagged `toLocaleString()` on prices), `exportUtils.ts` ("Generated …" with untagged locale).
Number formatting is mostly correct already: the appointments calendar uses `ar-u-nu-latn-ca-gregory` and most money uses `'en-US'`. The gap is the handful of bare `toLocaleString()` / `toLocaleDateString()` calls, which inherit the browser locale and can emit Eastern Arabic digits.

### F6 — Bagrut conversion (confirmed correct, one policy question)
`src/utils/gradeConverter.ts` implements the Modified Bavarian Formula `1 + 3(Nmax − N)/(Nmax − Nmin)` correctly, rounds to 2 decimals, validates range and `Nmax > Nmin`. Math is right.
Open item: `N_min` defaults to 55. uni-assist treats the Bagrut minimum pass as 55 in most cases, but the value should be surfaced in the UI rather than hidden as a default, and grades below `N_min` currently produce values above 4.0 that are labelled "Fail" — correct, but should be shown as "not passing / verify with uni-assist" rather than a number applicants might quote.

### F7 — No draft protection anywhere (confirmed by absence)
No `localStorage`/autosave usage in any team form. `ProfileCompletionForm`, `SubmitNewStudentPage` and `PaymentConfirmationForm` are long forms whose state is lost on refresh, tab crash, or session timeout.

---

## Unverified — investigate before fixing

- **U1 "Submitted page issue".** The page queries `cases` with status in `submitted`/`payment_confirmed` for the pending tab and `enrollment_paid` for completed. The database currently holds 1 case in `submitted`, 0 in `payment_confirmed`, 0 in `enrollment_paid`. That is consistent, so I cannot yet name a root cause. Step 1 of the work is to reproduce with you: which tab, what you expected, what appeared.
- **U2 Table width on large monitors.** Needs a measured pass over `SheetTable`, `ReadyToApplyTable`, and the admin management tables at ≥1600px before I claim a specific container is capping width.
- **U3 Permission gaps for multi-admin/multi-lawyer operation.** RLS was hardened in earlier rounds; a fresh matrix test per role is needed rather than an assumption.

---

## Roadmap

### Critical — implement immediately

| # | Item | Files / surface | Complexity |
|---|---|---|---|
| C1 | Delete the `partner@gmail.com` test payout + its orphan `transaction_log` row; add a DB check so `paid_at` requires `status='paid'` | data cleanup + migration | Low |
| C2 | Fix the submissions commission preview to resolve the single linked partner (mirror `record_case_commission`); drop the dead zero-UUID query | `AdminSubmissionsPage.tsx` | Low |
| C3 | Reproduce and fix the Submitted page problem (U1) | `AdminSubmissionsPage.tsx` | Unknown until reproduced |
| C4 | Draft autosave + restore + unsaved-changes guard on all long forms | new `useFormDraft` hook; `ProfileCompletionForm`, `SubmitNewStudentPage`, `PaymentConfirmationForm`, `CaseDetailPage` notes | Medium |

### High priority

| # | Item | Files | Complexity |
|---|---|---|---|
| H1 | FAQ in More nav (desktop + mobile) and in Resources | `DesktopNav.tsx`, `MobileNav.tsx`, locales | Low |
| H2 | New unified scheduler: month strip + day agenda + tappable time slots, shows the team member's existing bookings, blocks conflicts, one confirm click. Replaces the three duplicate dialogs | new `AppointmentPicker`, `AppointmentSchedulerModal`, `ScheduleDialog`, `RescheduleDialog` | High |
| H3 | Translate the team workflow strings and replace raw `err.message` toasts | scheduler dialogs, `TeamStudentProfilePage`, locales | Low |
| H4 | Pin every remaining bare `toLocaleString`/`toLocaleDateString` to `en-US` (or `ar-u-nu-latn`) so digits are always Western | `CaseDetailPage`, `TeamStudentProfilePage`, `exportUtils.ts` | Low |
| H5 | Context prefill: opening any case-scoped form pre-populates name, phone, email, assigned member, partner, program, payment status from the case record; read-only where the case owns the value | case-scoped forms | Medium |

### Medium priority

| # | Item | Complexity |
|---|---|---|
| M1 | Full locale sweep: script that diffs `ar` vs `en` key sets per namespace, fails CI on missing/placeholder keys | Low |
| M2 | Table/layout pass at ≥1600px: fluid containers, sticky headers, sensible column widths, pagination (after U2 measurement) | Medium |
| M3 | Bagrut UI: expose `N_min`, label sub-pass results as "verify with uni-assist" instead of a bare number | Low |
| M4 | Role matrix test (U3) — one automated pass per role asserting exactly which rows each role can read/write | Medium |
| M5 | Dashboard gaps: team "my day" workload counter, admin SLA/aging view, partner earnings-by-stage, student next-action card | Medium |

### Future enhancements

- Firecrawl: worth it, but narrowly. Value is in monitoring a fixed list of German university/uni-assist/embassy pages for changes to deadlines, tuition, and document requirements, then raising an admin review task — not free-form scraping. Implementation: an edge function on a weekly schedule, crawl a curated URL list, diff against the last snapshot, store changes, notify admin. Maintenance is the real cost: selectors and URLs drift, so budget periodic upkeep. Recommend deferring until the FAQ/resources content set is stable enough to be worth auto-checking.
- Notification/reminder automation (appointment reminders, SLA nudges) once the scheduler lands.
- Keyboard command palette for admin/team case navigation.

---

## Technical notes

- The commission preview fix must read `cases.partner_id` first and fall back to `referred_by`, then apply that partner's override — identical branching to `record_case_commission`, so preview and write can never diverge.
- The `paid_at` guard belongs in a trigger, not a CHECK constraint (time/state dependent validation).
- Draft autosave stores per-user, per-entity keys in `localStorage` with a version stamp, clears on successful submit, and prompts on mount when a newer draft exists.
- The scheduler needs one query for the member's appointments in the visible range; conflict detection compares `scheduled_at + duration_minutes` overlaps client-side and is re-checked on insert.

---

## Suggested order

1. C1 + C2 (finance correctness — small, high trust value)
2. H1 + H3 + H4 (fast visible wins)
3. C3 after you describe the Submitted symptom
4. C4 draft protection
5. H2 scheduler
6. H5 prefill, then the Medium block
