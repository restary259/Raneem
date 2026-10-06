# Student Visa Information wizard (Heidelberg language-course visa)

## What the student gets
On **Student → Visa**, a "Visa Information" wizard replaces today's loose form:

1. Personal (name, birth surname, date/place/country of birth, sex, marital status, nationality, former nationality, children; height + eye colour as optional)
2. Family (father + mother, collapsible, optional)
3. Contact (address, postal code, city, country, phone, email)
4. Passport (type, number, issue date, valid until, issuing country/authority)
5. Germany & travel (purpose defaults to "Intensive German language course", arrival/departure, duration, city, German address, accommodation type, home residence kept, family accompanying, health insurance yes/no/not yet)
6. Previous Germany stay (Yes/No, details appear only on Yes)
7. Background questions (conviction, deportation, rejected permit, refused entry — neutral wording, explanation fields appear only on Yes)
8. Financing (who pays living costs and travel, options incl. Verpflichtungserklärung, notes)
9. Review — grouped summary with Edit per section, accuracy confirmation, Submit

- Header text + "6 / 9 completed" progress; Back / Continue sticky footer, mobile-first, RTL.
- Every step autosaves; returning resumes where they left off.
- Editable until submitted; after "Needs correction" it unlocks again with the team note shown at the top.
- No health/medical section (no official requirement confirmed; nothing invented).
- No prefilled fake data — only real values already on the student's profile (name, phone, email, DOB, nationality, passport expiry, eye colour, address) are shown pre-filled for confirmation.

### Required vs optional
- Required: identity, contact, passport, travel dates/stay, previous-stay Yes/No, the four background Yes/No questions, financing.
- Conditional: explanation fields, previous-stay details, sponsor info.
- Optional: height, eye colour, family block.

### Validation
Real dates; passport valid-until after issue date; arrival not in the past; height 100–250 cm; passport number 5–20 letters/digits. Values are never auto-changed.

## What team and admin get
In the student's case (existing Visa tab / admin Visa page "Information" panel):
- Same nine sections, read-only, with the German form term shown beside each label.
- Status badge: Draft, In progress, Submitted, Needs correction, Checked.
- Buttons: **Mark checked** and **Needs correction** (note required, shown to the student).

## Technical section

**Reuse first (verified)**
- `profiles` already holds name, phone, email, DOB, nationality, passport_expiry, eye_color, address fields, criminal-record and dual-citizenship flags. The wizard reads/writes these through `StudentService.updateProfile` instead of duplicating them.
- `visa_fields` / `visa_field_values` (admin-configurable key-value) stay as-is; existing admin custom fields still render below the review summary.
- `visa_applications` (one row per case) is the case-linked home; it only has a few columns today.

**Manual SQL (user deploys)** — `docs/manual-sql/20261006130000_visa_information.sql`, additive only:
- Add to `visa_applications`: `info jsonb not null default '{}'` (per-section answers not on `profiles`), `info_status text default 'draft'` (draft|in_progress|submitted|needs_correction|checked), `info_last_step int`, `info_submitted_at`, `info_checked_at`, `info_checked_by`, `info_correction_note`.
- RPCs (SECURITY DEFINER, empty search_path, explicit EXECUTE grants):
  - `save_my_visa_info(case_id, section, payload, last_step)` — student only, own case, blocked when status is submitted/checked; upserts the row.
  - `submit_my_visa_info(case_id)` — validates required sections server-side, sets submitted + timestamp, logs `case_events`.
  - `review_visa_info(case_id, decision, note)` — admin or team with case access (`can_read_case`); note required for needs_correction; notifies student.
- No RLS widening; students write only via RPCs. No data deleted.
- Verification queries included.

**Frontend**
- New `src/components/student/visa/VisaInfoWizard.tsx` + one small file per step, reusing `OnboardingShell`, `BirthdayPicker` (future-year range for travel dates), `FieldGroup`.
- `src/lib/visaInfoSchema.ts` — zod schemas per step, required/conditional rules, shared by wizard and review.
- `src/services/VisaService.ts` — `getMyVisaInfo`, `saveVisaInfoSection`, `submitVisaInfo`, `reviewVisaInfo` (errors thrown, never swallowed to empty).
- `StudentVisaPage.tsx` — mounts wizard; existing legal/identity block moves into steps 1 and 7.
- `VisaInformationPanel.tsx` + `StudentOverview` Visa tab — grouped read-only view, status badge, review actions.
- i18n keys `visaInfo.*` in en/ar/he for both `public/locales` and `src/locales`.

**Tests**
- Schema: required/conditional rules, date ordering, height bounds.
- Wizard: resume at last step, Yes reveals explanation, locked after submit, unlocked on needs_correction.
- Panel: team review requires note for needs_correction.
- i18n parity test stays green.

## Out of scope
Case pipeline (visa stays outside case status), money, WhatsApp, document uploads, the `/apply` success screen.
