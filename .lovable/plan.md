# Case Flow — Audit & Fix Plan

Read-only audit of the three problems you reported, plus a live test run of case `raneem` (`320150e5…`).

---

## 1. Payment confirmation is blocked — CRITICAL, and it's my regression

**Confirmed from the database error log**, not guessed:

```
ERROR: record "new" has no field "team_member_commission_ils"
```

This error repeats ~30 times, matching every save you attempted at 03:08–03:15 UTC.

### What is happening

In the hardening migration I ran earlier, I added a guard trigger
`restrict_cases_financial_columns` (BEFORE UPDATE on `cases`). It compares six
commission columns — but two of them **do not exist** on the `cases` table:

| Referenced by the trigger | Exists on `cases`? |
| --- | --- |
| `platform_revenue_ils` | yes |
| `influencer_commission` | yes |
| `lawyer_commission` | yes |
| `school_commission` | yes |
| `team_member_commission_ils` | **NO** |
| `partner_commission_ils` | **NO** |

The guard body runs only when the user is *not* an admin. So:

- **Admin** updates → guard body skipped → work fine (that's why the admin
  `enrollment_paid` change at 01:55 succeeded).
- **Team member** updates → guard body runs → hits the missing field → the whole
  `UPDATE cases` transaction aborts.

### Observed damage on your test case

```text
03:08:59  Profile step   → case_submissions saved OK   (no triggers on that table)
                         → UPDATE cases   ABORTED      (silently — error not checked)
03:11:01  Payment step   → case_submissions saved OK   (service_fee 5000, payment_confirmed true)
                         → UPDATE cases   ABORTED      → red toast, status never moved
```

`cases.updated_at` is still frozen at **00:51:45** — no team-member write has
landed on the row since the migration. The case still reads `profile_completion`
even though payment is recorded on the submission row.

**Blast radius:** every non-admin write to `cases` — status advance, reassign,
name/phone edits from the profile step, notes. All broken since 03:05 UTC.

### Fix

- Rewrite `restrict_cases_financial_columns` to be column-agnostic: iterate a
  list of guarded column names and compare via `to_jsonb(NEW)->>col` vs
  `to_jsonb(OLD)->>col`, skipping any name not present on the row. This makes the
  guard impossible to break again by a rename or a dropped column.
- Guard the columns that actually exist: `platform_revenue_ils`,
  `influencer_commission`, `lawyer_commission`, `school_commission`,
  `referral_discount`, `commission_split_done`.
- Repair the stranded test case: move it to `payment_confirmed` and write the
  missing `activity_log` entry so the audit trail is not left with a hole.

### Related fix — silent failures

`PaymentConfirmationForm` and `ProfileCompletionForm` issue
`supabase.from('cases').update(...)` with no `.select()`. With RLS, a write that
matches zero rows returns **no error at all**, so the profile step failed
completely silently. Add `.select('id').single()` to both so a blocked write
always surfaces instead of pretending to succeed.

---

## 2. Rows show English while the UI is Arabic

Three separate causes:

**a. `ProfileCompletionForm.tsx` is 100% hardcoded English.** It imports
`useTranslation` but only pulls `i18n` — never `t`. Every step name
(`Personal Info`, `Contact Details`, `Program`, `Accommodation`, `Review & Save`),
every field label, every placeholder (`Street`, `House No.`, `Postcode`, `Year`,
`Month`, `Day`), the validation toast, and all 15 rows of the review summary are
literal English strings.

**b. `CaseDetailPage.tsx` builds labels from raw database keys.** The extra-data
grid does:

```ts
const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
```

So the column name `emergency_contact_name` renders as "Emergency Contact Name"
in Arabic mode. This is the "raw rows in English" you're seeing.

**c. Catalog names always use the English column.** Program, school,
accommodation and insurance names are read as `name_en` regardless of locale,
even though `name_ar` exists on every one of those tables.

### Fix

- Add a `case.profileForm.*` block plus a `case.extra.*` label dictionary to
  `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`.
  (The existing `case.detail.*` and `team.payment.*` namespaces are already
  complete at 83 and 10 keys in both languages — no gap there.)
- Wire `t()` through `ProfileCompletionForm`, including the `STEPS` array and the
  review summary.
- Replace the title-case fallback in `CaseDetailPage` with
  `t('case.extra.' + key, { defaultValue: <humanised key> })`, so unknown keys
  degrade gracefully instead of disappearing.
- Add a small `localizedName(row)` helper that picks `name_ar` when the locale is
  Arabic and falls back to `name_en`, and use it in both files.

---

## 3. Emergency contact auto-fills from email

`ProfileCompletionForm.tsx` has **zero** `autoComplete` attributes on 20+ inputs,
and the fields sit in bare `<div>`s with no `name` attributes. Chrome then
guesses by proximity and pours the saved email/phone into
**Emergency Contact Name** and **Emergency Contact Phone**.

### Fix

- Put `autoComplete="off"` and a unique, non-standard `name` (e.g.
  `name="darb-emergency-name"`) on both emergency fields — Chrome ignores plain
  `off` on recognised field names, so the unique name matters.
- Give the genuinely autofillable fields correct tokens instead
  (`email`, `tel`, `given-name`, `family-name`, `address-line1`, `postal-code`),
  which stops the browser guessing at the neighbours.

---

## Also found (no action requested yet)

- **19 triggers across 10 tables** reference functions that `authenticated` can no
  longer execute, after the earlier lockdown migration. I chased this as the
  likely cause first — it is **not** a problem: the log proves the trigger body
  *did* run and threw from inside, so Postgres does not re-check EXECUTE when a
  trigger fires. Leaving these as-is.
- `case_payments` still carries the broad `anon` grant I flagged previously.
- `programs`, `schools`, `accommodations` and `insurances` are all **empty**, so
  every dropdown in the profile step renders with no options. Worth seeding
  before a real case walkthrough.

---

## Technical notes

- Files: `src/components/team/ProfileCompletionForm.tsx`,
  `src/pages/team/CaseDetailPage.tsx`,
  `src/components/team/PaymentConfirmationForm.tsx`,
  `public/locales/{en,ar}/dashboard.json`, plus one migration.
- One migration: replace the guard trigger function, then repair the stranded case.
- No RLS policy changes. The `cases` policies are correct and were never the cause.

## Test run after the fixes

1. Confirm payment on `raneem` → status advances to `payment_confirmed`, and an
   `activity_log` row appears.
2. Advance to `submitted`, then admin-advance to `enrollment_paid`, and verify
   `auto_split_payment` still fires and writes revenue and rewards.
3. Reassign the case, and edit a field from the profile step — both must now
   error loudly rather than silently no-op.
4. Switch to Arabic and re-walk the profile step: assert no Latin text remains in
   labels or in the extra-data grid.
5. Autofill check: fill email, then confirm both emergency fields stay empty.
