# Case Detail — stage-driven rebuild

Rebuild `/team/cases/:id` (also used by admin) so the page only shows what matters at the case's current stage, matches the data the admin already configured (schools, programs, accommodations, insurance, service catalog), and mirrors the "+ New student" form for the profile step.

## 1. Page structure

Everything becomes a single scrolling column of stage-aware blocks — no more four tabs.

```text
Header (name, case ref, assignee, status chip, progress rail, actions)
Needs attention
Overview            <- collapsible, always present
[stage block]       <- only the block for the current stage
Program & Finance   <- appears only from PAYMENT stage onward
```

Removed for good: the Messages tab (case chat), the History tab (السجل الزمني / timeline), the standalone Documents card, the "Key facts" grid.

## 2. Overview (collapsible, always available)

Closed by default, showing only the essentials from the apply form and the case origin:

- Name, phone, city, education level, passport type, degree interest, bagrut / English / math units, intake note.
- Origin: source (apply, partner link, referral, team-submitted), the partner name when `partner_id` is set, or the referrer when `referred_by` is set, plus created date.

Read-only. No program, no money, no documents here.

## 3. Stage blocks — one at a time

| Stage | Block shown |
|---|---|
| New | Contact the student: call/WhatsApp, then "Mark as contacted" |
| Contacted | Schedule the first appointment |
| Appointment scheduled | Appointment list with record-outcome; profile step unlocks after an outcome |
| Profile completion | Full student profile form (see 4) + student account invite (see 5) |
| Payment confirmed | Cost breakdown + payment collection, then "Submit to admin" |
| Submitted | Read-only summary waiting for admin enrollment |
| Enrollment paid | Final summary |

Blocks for other stages are not rendered at all, so the page stays clean.

## 4. Profile completion — identical to the "+ New student" page

The profile block reuses the same field set and validation as `SubmitNewStudentPage`, in the same order:

- Student info: first / middle / last name, date of birth (year-month-day selects), gender, city of birth.
- Contact: email, phone, emergency contact name and phone, street, house no, postcode, city.
- Program: school, program, intake month, arrival date, course start (auto from the program's fixed start day), course end (auto from duration), accommodation filtered by school, insurance.

Values prefill from the case row and `case_submissions.extra_data`; saving writes back to the same `extra_data` shape plus the `program_id` / `accommodation_id` / `insurance_id` / date columns, so nothing diverges between the two entry paths.

## 5. Student account invite — team-owned, email fetched from the case

The email lives on the profile form and is owned by the team member, not the admin. Once the profile is complete:

- A "Create student account & send invite" button appears, prefilled with the email already on the case (`extra_data.student_email`); it is editable until the account exists.
- It calls the existing `create-student-from-case` function, which links `cases.student_user_id`, copies case data into the student profile, and emails the invite with the temporary password.
- After success the block shows the linked account and the button turns into "Resend invite".
- Verification: run a live invite to `tsukuyomidomain00@gmail.com` after the rebuild and confirm the account, the profile sync and the delivered email.

## 6. Program & Finance — automatic, and only at the end

Appears once the profile is submitted (payment stage onward). No manual line entry by the team:

- On profile save, the case's services are generated automatically from the admin catalog: program price, accommodation price, insurance price (age and duration aware, existing `computeInsuranceCost`), and the service fee from the service catalog default.
- The block renders a breakdown — each line with its own currency (₪ / €) — plus totals: subtotal, discounts, paid, remaining.
- The team records incoming payments here and waits; "Submit to admin" only unlocks when the balance reaches zero.
- Admin can still adjust lines; the team can only record payments.

## 7. Call button behaviour

- Mobile (`useIsMobile`): `tel:` as today.
- Desktop: opens WhatsApp Web for the case phone (`https://wa.me/<digits>`) in a new tab, with the number normalised to international form.

## 8. Localisation and formatting

Every new label goes through `t()` with matching Arabic and English entries — this also clears the current hardcoded English in the student block ("Personal Information", "Edit Profile", "Send Checklist"). Numbers and dates stay `en-US`; money keeps ₪ / € formatting. RTL check on the new layout.

## Technical notes

- `src/pages/team/CaseDetailPage.tsx` — reduced to header + attention panel + overview + a stage block switch; tabs, timeline, messages and documents cards removed.
- New `src/components/cases/CaseOverviewPanel.tsx` (collapsible origin/apply facts) and `src/components/cases/stages/` with one small component per stage.
- `CaseStudentTab.tsx` replaced by `CaseProfileForm.tsx`, sharing the field definitions with `SubmitNewStudentPage` via a new `src/lib/studentProfileFields.ts` so the two never drift.
- New `src/services/CaseCostingService.ts` — builds `case_services` rows from program / accommodation / insurance / service-catalog prices when the profile is saved; idempotent per case.
- `CaseFinance.tsx` reused for the breakdown, gated by stage.
- `public/locales/[ar|en]/dashboard.json` — new keys under `case.overview.*`, `case.stage.*`, `case.profile.*`.
- No database schema or RLS changes; the case chat table and inbox pages stay untouched, only the case-page tab is removed.

## Verification

- `deriveCaseTasks` unit tests updated for the new stage blocks.
- Playwright pass over a real case: each stage renders only its block, profile save writes the same shape as the + New form, costing lines appear after save, no raw i18n keys.
- Live invite email test to `tsukuyomidomain00@gmail.com`.
- Arabic RTL screenshot check on desktop and mobile widths.
