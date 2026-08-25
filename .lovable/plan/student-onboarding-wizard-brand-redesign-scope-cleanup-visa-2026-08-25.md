# Student onboarding wizard: brand redesign + scope cleanup + visa tab

## What changes for the student

1. **Branded wizard** — the onboarding wizard opens with the DARB logo, brand colours and a proper welcome, instead of the current plain card shell.
2. **Starts with a confirmation step** — the first screen shows the name, phone and personal email already on file from the account they were invited with. The student either confirms it as correct or edits it, then continues.
3. **Shorter wizard** — removed: arrival date (unknown at activation) and the whole visa/legal block (eye colour, passport expiry, changed legal name, criminal record, dual citizenship). Emergency contacts stay.
4. **New Visa tab** — the visa/immigration questions move to the student's Visa page, filled in later when the student actually applies. What they enter is visible to team and admin.

Resulting wizard: **Step 1 Confirm your details → Step 2 Personal details → Step 3 Study → Step 4 Emergency contacts**.

## Design direction

Locked to the existing DARB brand, no new palette:
- Blue DARB logo (`/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png`, the same one used on the login and activate pages) in the wizard header.
- Semantic tokens only (`--brand`, `background`, `card`, `border`, `muted-foreground`) so light/dark and RTL keep working.
- Warmer editorial shell: logo + progress rail on top, one question per screen, large headline, sticky footer with Back / Continue.

## Technical notes

**`src/components/student/OnboardingShell.tsx`**
- Add the logo to the header row next to the step counter; brand-tinted progress rail; refined spacing/typography. Presentational only — no state or prop-contract changes beyond an optional brand header.

**`src/components/student/StudentOnboardingGate.tsx`**
- `TASKS`: drop `arrival_date`, `eye_color`, `passport_expiry`, `has_changed_legal_name`, `has_criminal_record`, `has_dual_citizenship`; add a new `confirm-identity` task as task 0 rendering full name / phone / email with an explicit "these details are correct" confirmation before Continue enables.
- Steps collapse from 4 to 4 with new meaning (confirm / personal / study / contacts); `stepComplete`, `isProfileComplete`, `stepPatch`, resume logic and `SELECT_COLUMNS` updated to match. Email is read from the auth session and written to `profiles.email` only if the student edits it.
- `isProfileComplete` no longer requires arrival date or the visa fields, so no existing student gets re-gated.
- Update `StudentOnboardingGate.test.ts` expectations for the new required set.

**`src/pages/student/StudentVisaPage.tsx`**
- Already renders the dynamic admin-configured `visa_fields` plus eye colour and the three legal switches, saving to `visa_field_values` / `profiles`. Add passport expiry to that page (it leaves the wizard) and tighten the layout into two clear sections: "Immigration office questions" and "Legal & identity".

**Team / admin visibility**
- `StudentOverview`'s Visa tab already loads `visa_fields` + `visa_field_values`, so dynamic answers already surface for team and admin. Extend its read-only visa view to also show the legal/identity profile fields (eye colour, passport expiry, legal-name change, criminal record, dual citizenship) so everything the student enters on the Visa page is visible in both dashboards.
- No RLS/migration changes: team already has SELECT on visa values, admin has full access, and the profile columns already exist.

**i18n**
- New keys under `studentOnboarding.confirm*` and `visa.*` added to `en` and `ar` together; removed tasks' keys left in place (the parity guard only flags missing keys).

## Out of scope
No changes to case pipeline, commissions, RLS, or the profile write trigger.
