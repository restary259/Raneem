# Batch 5 — Profile Completion, Validation Guardrails, Catalog & Service Selection

## Audit summary (read-only, verified this turn)

What already exists and works — will be **verified**, not rewritten:

- One profile definition (`src/lib/studentProfileFields.ts`) shared by the case profile form and the "+ New student" page, stored in `case_submissions` (+ `extra_data`). Draft autosave writes `draft_updated_at`; the DB is the source of truth. No duplicate draft table.
- School → course/accommodation filtering already exists in the form (course and accommodation lists are filtered by `school_id`, and changing school clears both), and the backend already enforces it with the `enforce_submission_school_consistency` trigger.
- Week-based pricing lives in one place: `src/lib/programPricing.ts` (`resolveWeeklyRate`, `computeWeeklyCost`) with `COURSE_DURATION_WEEKS = 40` in `studentProfileFields.ts`. Catalogue `price` is a weekly rate with `price_tiers`.
- Backend stage gate `enforce_case_stage_transition` blocks skipping Profile Completion.
- Phone-format validation was added in Batch 4 on the frontend (`isValidPhone`).

Problems found that this batch fixes:

1. **Service catalog is half-placeholder.** `service_catalog` holds 8 rows; only "Core service fee" (₪4,000) is active, the rest are inactive placeholders and do not match the real service names (Bank Account, University Registration, Bagrut Translation, Notarized Papers, SIM Card, Insurance, Language Course Registration, Accommodation).
2. **No Full Service concept anywhere** in the codebase or the database.
3. **Team can invent services and set any price.** `CaseServices.tsx` has a manual "Add service" form with free-text price/qty/discount, and the `case_services` RLS policy lets a team member insert any row for their case. This is a real backend gap, not a UI-only one.
4. **A second, legacy hardcoded catalogue** exists: `src/lib/language-school-data.ts` (hardcoded schools/rooms/weekly rates).
5. **Service fee mismatch:** the auto-added service line is ₪4,000 while the confirmed enrollment/service payment is ₪5,000.
6. **No backend format validation** for `student_email` / `student_phone` on `case_submissions` — only the frontend blocks bad values.

## What will be built

### 1. Service catalog becomes the single source of truth (migration)
- Add to `service_catalog`: `code` (stable slug), `in_full_service` (boolean), keep `default_price`, `is_active`, `sort_order`.
- Seed/rename rows to the real service list using existing terminology: Full Service (the bundle toggle itself is derived, not a row), Language Course Registration, Accommodation, Insurance, Bank Account (blocked account), University Registration, Bagrut Translation, Notarized Papers, SIM Card. Existing rows are renamed/reused where they match — no duplicate rows, and existing `case_services` keep pointing at their row.
- Full Service composition = every catalog row with `in_full_service = true`. Admin-configurable, defined in exactly one place.

### 2. Team selects, never invents (migration + UI)
- New `SECURITY DEFINER` RPC `set_case_services(p_case_id, p_service_ids uuid[])`: validates the caller may manage the case, deletes de-selected lines, inserts newly selected ones **copying `default_price` from the catalog at selection time**, and never touches lines that are already there (historical pricing is frozen).
- Tighten `case_services` RLS: team members keep SELECT, lose direct INSERT/UPDATE/DELETE (admins keep full control). All team writes go through the RPC.
- Rewrite `CaseServices.tsx` as a compact checkbox list of active catalog services, showing each configured price, a "Full Service" toggle that selects every `in_full_service` row, the running total, and a save action. The manual "Add service" form and the price/qty/discount inputs are removed from the team UI (admin catalog config untouched).

### 3. Admin service settings (`ServiceCatalogPanel.tsx`)
- Add an "included in Full Service" switch per row plus the existing name/price/active editing, so the bundle is configured where prices are configured.

### 4. Validation guardrails
- Backend trigger on `case_submissions` rejecting malformed `student_email` / `student_phone` (same rules as the frontend), plus a required-field guard so a submission cannot reach `submitted` with an empty school/program/intake.
- Frontend: reuse `missingProfileFields` (already lists exactly what is missing, per field) — no generic "something went wrong"; map backend exceptions to the same named-field messages.

### 5. Pricing presentation
- Course cost shown as `€X / week × 40 weeks = €Y` from `computeWeeklyCost`, with a short note that the school's final invoice may differ. No new multiplier: any duplicated `* 40` found in `SubmitNewStudentPage.tsx` / `CaseProgramTab.tsx` is replaced by the shared helper.

### 6. Legacy
- `src/lib/language-school-data.ts` is checked for live imports; removed only if unused, otherwise reported.

## Verification (each step reported separately)

Driven end-to-end in the browser on the Batch 4 demo case as the demo team user, plus DB checks:
per-field typing/paste/delete/edit continuity, draft survives refresh and navigation, invalid email/phone/date rejected on both layers, school switch clears incompatible course + accommodation (frontend and a direct API call that bypasses the UI), intake persistence, service selection + Full Service persistence with no duplicate rows, catalog price change does not rewrite an existing case's lines, team-role attempt to insert a service or change a price is rejected by the backend, and a 390px mobile pass over the whole form.

## Open items

- Admin UI verification of enrollment (Batch 4 STEP 12) is still blocked by the admin 2FA gate.
- The ₪4,000 vs ₪5,000 service-fee mismatch is flagged; the catalog seed will set the core service fee to the value you confirm.

## Technical notes

- Migrations: one for `service_catalog` (`code`, `in_full_service`, seed/rename), one for `set_case_services` + `case_services` RLS tightening, one for the `case_submissions` validation trigger.
- No new tables. No new profile, school, course or accommodation system — the existing `schools` / `programs` / `accommodations` / `case_submissions` graph is reused as-is.
