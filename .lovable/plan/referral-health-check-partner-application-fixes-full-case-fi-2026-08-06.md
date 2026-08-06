# Referral Health Check, Partner Application Fixes & Full Case File

Four connected fixes: make referral tokens trustworthy, make the partner application form actually reach you and look right, and give admins a real case file page.

## 1. Referral link health check (no misattribution)

Today a `?ref=` token is stored in the browser and sent on submit; if the code is old, disabled, or belongs to a deleted account, the lead is saved with a dangling code and can end up unattributed — or attributed by a stale value kept from an earlier visit.

What we add:

- A public lookup that answers one question only: "is this code currently valid, and what is the owner's display name?" It returns no email, no id, nothing sensitive.
- On the Apply page the stored code is checked before the form is used:
  - Valid → small green line: "You were referred by <name>".
  - Invalid, disabled, or belonging to a removed account → the stored token is deleted immediately and the application is submitted with no attribution rather than a wrong one.
- Any newly arriving `?ref=` replaces an older stored one, and a stored token is never reused after it fails a check.
- Admin health panel (Settings → Referrals): lists every code that is currently broken — leads carrying a code no attribution could be made from, accounts whose link is disabled, and duplicate codes — with the count and the affected names, so you can fix or re-issue links.

## 2. Partner application form ("انضم إلى شبكة وكلائنا")

- The form currently only triggers an email. It will also be recorded in the submissions table so an application is never lost if email delivery fails, and the success message only appears once the record is stored.
- Fix the yes/no buttons from the screenshot: the circles stretch into ovals because they are squeezed by the flexbox row. They get a fixed, non-shrinking size and correct right-to-left spacing, so they render as proper round radio buttons with the label beside them.
- Make the whole question block keyboard- and screen-reader-correct (one grouped question, two labelled options).

## 3. Admin "Open full case" opens the full file

Admins currently land on the pipeline board with a side panel. We add a real admin case page at `/admin/cases/:id` that reuses the existing full case file screen (profile, appointments, submission, documents, status actions) and change the button to navigate there.

## 4. End-to-end tests

New Playwright spec for the partnership page:

- Page loads, heading and form are visible in Arabic.
- Yes/no options are clickable and only one can be selected.
- Validation blocks an empty submit with Arabic messages.
- A complete submission (network call stubbed) shows the Arabic success toast.
- A referral link with an invalid code does not attribute, and the Apply page shows no partner name.

Existing specs continue to run in the same CI job.

## Technical notes

- New database function `check_referral_code(text)` — security definer, returns `{valid boolean, owner_name text}`, granted to `anon` and `authenticated`; reads `profiles.referral_code` with `referral_code_enabled = true` and `deleted_at is null`. No other columns leave the database.
- `src/lib/referral.ts`: add `verifyReferralCode()` and drop the stored token on a failed verification; keep server-side resolution in `insert_lead_from_apply` as the single source of attribution truth.
- `src/pages/ApplyPage.tsx`: verify on mount, render the attribution line, and send `ref_code` only when verification passed.
- New `src/components/admin/ReferralHealthPanel.tsx`, mounted as a tab in `SettingsPanel.tsx`; queries leads with a `ref_code` that no active profile matches.
- `src/components/partnership/RegistrationForm.tsx`: `RadioGroupItem` gets `shrink-0`, row uses `gap-3` instead of `space-x-2 space-x-reverse`; mutation inserts into `contact_submissions` (`form_source: 'partnership'`) before invoking `send-email`, and treats a failed email as a warning, not a failed application.
- `src/App.tsx`: add `<Route path="cases/:id" element={<CaseDetailPage />} />` under `/admin`; `AdminSubmissionsPage.tsx` navigates to `/admin/cases/<id>`.
- New `e2e/partnership.spec.ts`; translations for the new health-panel and attribution strings added to both `dashboard.json` and `partnership.json`.
