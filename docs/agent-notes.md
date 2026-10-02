# Raneem (DARB) ŌĆö Agent Notes

Repository-specific context for the DARB case-management app (TanStack Start + React + Supabase). The application has already completed its TanStack Start migration; do not introduce a second framework migration for WhatsApp.

## White-screen / build-time env var guard (deployment safety)

- `.env` is git-ignored and never deployed. The published build (Vercel/Lovable)
  MUST have `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configured as
  **build-time** environment variables (Vite inlines `VITE_`-prefixed vars during
  `npm run build`). Without them, `src/integrations/supabase/client.ts` throws a
  human-readable `[Darb] Supabase client could not be initialized...` error and
  paints a visible "Configuration error" panel instead of a silent white screen.
- `src/main.tsx` wraps `<App/>` in `<Suspense>` (inside the outermost
  `<ErrorBoundary>`). `App` calls `useTranslation("dashboard")` at its top level
  while react-i18next runs in suspense mode (`react.useSuspense: true` in
  `src/i18n.ts`), so a failed/late `/locales/*.json` load suspends ŌåÆ fallback,
  not an unhandled throw. Never remove this top-level Suspense boundary; the
  inner Suspense boundaries in `App.tsx` sit *below* the `useTranslation` call
  and cannot cover it.
- `vercel.json` rewrites `/((?!locales/).*)` ŌåÆ `/` so the i18next HttpBackend
  `/locales/{{lng}}/{{ns}}.json` requests are served as static JSON
  (`application/json`), never rewritten to `index.html`. `public/locales/**`
  is copied into `dist/locales/**` by the Vite build.

## Finance tab architecture

- `src/components/cases/CaseFinance.tsx` ŌĆö orchestrator of the Finance tab. Renders the
  KPI summary (Service total / Paid / Awaiting / Remaining) from `get_case_financials`,
  the DARB service selector, the payment-confirmation card, payment history, the
  Germany (EUR) cost + proof-verification block (admin only / final stages), the
  submission-readiness checklist, and a single **Confirm & Save** action.
- `src/components/cases/CaseServices.tsx` ŌĆö the single service-package selector.
  Exposes an imperative handle (`CaseServicesHandle`: `save`, `isDirty`,
  `selectedCount`) via `forwardRef` so the parent's one button persists the selection.
  A single `Select` chooses **Full Service** (locked, auto-populated bundle from
  catalog rows where `in_full_service = true`) vs **Custom Services** (editable
  per-service checkboxes). There is no separate Save button in this component.
- `src/components/cases/CasePayments.tsx` ŌĆö payment history only. Business-rule notes
  live once, consolidated in `CaseFinance` (`finance.notes.*`).

### Single-action rule (do not reintroduce duplicates)
- ONE service-selection mechanism (the package dropdown), not Full Service checkbox
  + individual checkboxes competing.
- ONE confirmation button (**Confirm & Save**) at the bottom of the Finance tab.
  Removed surfaces: the standalone "Save" button, the inline "Confirm DARB Payment"
  button, and the `PaymentConfirmationForm` modal (deleted). The attention-panel and
  stage-block "confirm payment" actions now scroll to the Finance section
  (`focusFinance` + `financeRef` in `CaseDetailPage`).
- The DARB payment-confirmation card renders ONLY while the fee is unpaid. Once
  confirmed, it disappears and the payment appears exactly once, in Payment History.

### Finance ŌåÆ Submit-to-Admin flow (single place)
- **Confirm & Save** (bottom of Finance tab) saves services and, when the team
  ticks the confirmation checkbox, confirms the DARB agency fee via
  `confirm_agency_service_payment`. It does NOT submit the case or send invites.
- `confirm_agency_service_payment` (migration `20260810150000_confirm_payment_flips_status.sql`)
  is idempotent and does THREE things atomically: marks the
  `case_finance_confirmations` `service_fee` row confirmed, sets the legacy
  `case_submissions.payment_confirmed = true` (required by the
  `payment_confirmed -> submitted` transition trigger and `submit_case_for_review`),
  and advances the case `profile_completion -> payment_confirmed`. Without the
  legacy flag flip the case can never be submitted (the trigger blocks it).
- AFTER payment is confirmed, a **"Create the student account & send invite"**
  block renders inside the Finance tab (only at `payment_confirmed` status). Its
  single button calls `CaseDetailPage.handleSubmitToAdmin`, which runs
  `submit_case_for_review` (issues the DARB invoice) + `sendInvoiceEmail` +
  `create-student-from-case` (student dashboard invite). This is the ONE place
  the team submits to Admin; `CaseStageBlock` no longer has a duplicate submit
  dialog/`CaseInviteStudent` inline ŌĆö it only points back to the Finance tab.
- Services are server-locked once the case is past `profile_completion`
  (`submitted`/`payment_confirmed`/`enrollment_paid`/`enrolled`). `CaseServices`
  accepts a `caseStatus` prop, renders read-only, and makes `save()` a no-op when
  locked so the single Confirm & Save button never hits the locked
  `set_case_services` RPC.

## Referral discount in the commission split (2026-08-13)
- The referral discount must be absorbed by DARB's margin, not ignored.
  `get_case_financials` / `get_case_darb_service_total` subtract
  `cases.referral_discount` from the service total (Step 2), so the invoice and
  the admin Payment-Split preview show the NET amount. `record_case_commission`
  must use the SAME net base for `platform_revenue_ils` or the recorded value
  disagrees with the invoice/finance summary.
- `record_case_commission` (fixed by migration
  `20260813160000_fix_referral_discount_in_commission.sql`) computes
  `v_base` (gross, all `case_services` rows ŌĆö NO `currency='ILS'` filter, matching
  `get_case_darb_service_total` which sums all rows and hardcodes `currency='ILS'`),
  then `v_net = GREATEST(v_base - referral_discount, 0)`, and
  `platform_revenue_ils = GREATEST(0, v_net - team - pool)`. Team/partner/master
  flat commissions are UNCHANGED (flat amounts, not a % of base) and keep using
  gross `v_base` as `rewards.base_amount`. The `IF v_base <= 0` guard stays on
  gross. The audit payload logs BOTH `base_amount` (gross) and
  `net_after_discount` (net). This matches `COMMISSION_RULES.md` ┬¦4 where
  `service_fee` is the NET discounted DARB total.
- Worked example (Ōé¬5000 case, Ōé¬500 discount, Ōé¬100 team, student referrer so Ōé¬0
  pool): invoice/finance `service_total` = Ōé¬4500; admin split preview platform
  revenue = Ōé¬4500; recorded `platform_revenue_ils` = Ōé¬4500 (was Ōé¬4900 before fix).
- **Existing data caveat**: cases already at `enrollment_paid` with a
  `referral_discount > 0` BEFORE this deploy have an overstated
  `platform_revenue_ils`. `CREATE OR REPLACE` cannot retroactively fix them
  (`commission_split_done` guards re-run). The migration includes a diagnostic
  SELECT (comment) to find them; a one-time manual correction is an operator
  decision, NOT auto-applied.
- **Admin Referrals "Discount" column** derives from the linked case's
  `referral_discount > 0` (`discountAppliedFromCase` in
  `src/lib/referralDiscount.ts`), NOT the stale `referrals.discount_applied`
  boolean (which was never flipped to true by any code path). The page already
  fetches linked cases; it now selects `referral_discount` on that query. Single
  source of truth = the snapshotted case column that finance actually subtracts.

## Surface referral discount in the UI (2026-08-13)
- The backend `get_case_financials` returns `referral_discount` as its own field,
  but the frontend previously consumed only the netted `service_total` and dropped
  `referral_discount`, so the discount was invisible to users. It is now surfaced
  as a visible line item everywhere DARB service totals appear.
- **Single normalizer**: `selectInvoiceTotals` (`src/utils/invoiceTotals.ts`) is
  the one place `referral_discount` is parsed (clamped to Ōēź0, defaults to 0 for
  missing/non-numeric/legacy snapshots) and exposed on `DarbInvoiceTotals`. Every
  display surface derives from it; nothing re-parses the raw snapshot. The math
  reconciles: `subtotal ŌłÆ per-line discount_total ŌłÆ referral_discount = service_total`.
- **Surfaces that show the breakdown** (only when `referral_discount > 0`; no
  change when there is no discount):
  - `CaseFinance.tsx` Summary tab: KPI grid + an Original/Discount/Net block + an
    emerald "Referral discount applied" badge notice; Invoice tab: Original/Discount/Net
    rows replace the single "Service total" row.
  - `StudentFeesPage.tsx`: Original/Discount/Net block under the agency-services KPI grid.
  - `InvoicePage.tsx` (public invoice) + `invoicePdf.ts` (PDF): a `ŌłÆŌé¬` Referral
    discount row above the final total.
  - `case-invoice.tsx` email template: a separate `ž«žĄ┘ģ ž¦┘äžźžŁž¦┘äž®` LineRow after the
    per-line discount and before the total (`referralDiscount` prop from
    `buildInvoiceEmailData`); the existing `discount` prop still maps to the
    per-line `discount_total` only, so the two discounts are never conflated.
  - `AdminSubmissionsPage.tsx` Payment-Split panel: a read-only emerald line
    above the Service Fee indicating the discount was applied (Service Fee stays
    the net `service_total` the commission is computed on ŌĆö `record_case_commission`
    already nets referral_discount, so platformRevenue is unchanged).
- **i18n**: keys under `finance.summary.*` (originalTotal/referralDiscount/netTotal),
  `finance.referral.*` (applied/appliedDesc), `studentFees.*` (originalTotal/
  referralDiscount/netTotal), `admin.submissions.referralDiscount` ŌĆö added to en + ar
  together (parity guarded by `src/lib/i18nKeys.test.ts`).
- Build: `npm run build` (tsc+vite) clean; `npx vitest run` 317/317 pass incl. 2
  new `invoiceTotals.test.ts` cases (parse + reconcile) + i18n parity guard.

## Form draft autosave ŌĆö 30-min inactivity expiry (2026-08-13)
- `src/hooks/useFormDraft.ts` is the single reusable localStorage draft hook
  (prefix `darb:draft:`). Drafts are stored as `{ v, savedAt, data }` where
  `savedAt` is rewritten with `Date.now()` on every debounced write (600ms
  default), so expiry is measured from the LAST save (inactivity), not creation.
- **Expiry was a hardcoded 7 days; now 30 min** (`DEFAULT_EXPIRES_MS =
  30*60*1000`). Configurable via the `expiresMs` option (default 30 min). On
  mount, an expired/`savedAt`-past-TTL draft is removed from localStorage and
  the hook sets `expired: true` once (instead of restoring it) so the form can
  show the "expired after 30 min of inactivity" notice. `version`-mismatched
  drafts are still removed silently.
- **Active idle-timeout**: while enabled, a single `setTimeout` (re-armed on
  every `savedAt` change) removes a draft that sits idle past `savedAt + TTL`
  without needing a refresh ŌĆö no per-second re-renders. `clearDraft()` clears it
  and also clears the idle timer.
- New return fields: `expiresAt` (= `savedAt + TTL`, for the status UI),
  `expired` (set once on mount-expiry/active-expiry), `acknowledgeExpired()`.
  `savedAt`, `clearDraft`, `acknowledgeRestore` unchanged.
- **Consumers** (both call `clearDraft()` strictly after backend success; the
  catch/failed path does NOT clear, so the user can retry):
  - `ProfileCompletionForm.tsx` ŌĆö key `profile-completion:<caseId>` (per-case).
  - `SubmitNewStudentPage.tsx` ŌĆö key `submit-new-student` (one per device; left
    as-is). Key scoping to the auth user id was NOT added (would break existing
    valid drafts mid-session); only one new-student draft at a time per device.
  - The separate server-side draft in `CaseProfileForm.tsx`
    (`case_submissions.draft_updated_at`) is real submission data, NOT this
    localStorage system ŌĆö out of scope, unchanged.
- **Status UI**: `src/components/common/DraftStatus.tsx` renders a subtle
  "Ō£ō Auto-saved ┬Ę Expires in N min" line (emerald) that switches to amber under
  5 min, plus an optional secondary "Clear draft" button (confirms, calls
  `clearDraft`, resets fields ŌĆö never touches the case/submission record). A
  30s `setInterval` updates only a small local "minutes remaining" state ŌĆö it
  never re-renders the parent form. When `expired` is set, it shows the expiry
  notice instead. Used by both forms near their footer. Respects RTL (logical
  props, dir-aware via the existing layout).
- **i18n**: new keys under `common.draft.*` (`autoSaved`, `expiresIn`,
  `expiringSoon`, `expired`, `expiredBody`, `clearDraft`, `clearDraftConfirm`)
  added to en + ar (parity-guarded by `src/lib/i18nKeys.test.ts`).
- Tests: `src/hooks/useFormDraft.test.ts` (10 cases, fake timers) ŌĆö fresh /
  10-min / 29-min restore, 30-min+1s expired+removed, version mismatch, write
  resets the timer, active expiry while mounted, clearDraft, key isolation,
  disabled. Build clean; `npx vitest run` 327/327 pass (+10 new).

## Student account creation / invite (no dead activation links)

- `create-student-from-case` (edge function) has three invite-mode branches and
  must never send an activation link to an email that `accept-invitation` would
  reject:
  1. **Email already linked to a `case_submissions` student** (existing linked
     account): link the case, return `invited: false` ŌĆö no email (the student
     already has an activated account).
  2. **Existing activated STUDENT account** (not this case): in invite mode,
     link the case and return `invited: false, already_activated: true` ŌĆö no
     email. In manual mode, reset the password (admin-only) and return it.
  3. **Brand-new email**: in invite mode, do **not** pre-create the auth account
     (`admin.createUser`); `sendInvite` mints a durable `user_invitations` row
     (with `case_id`, `intended_role = "student"`, `invited_name`) and
     `accept-invitation` creates the account, assigns the role, upserts the
     profile, and links the case at activation. Manual mode still creates the
     account and returns a temp password. Pre-creating in invite mode caused
     resend races to hit "email already belongs to an account" at activation.
- **Invitation reconciliation (2026-08-13)**: a pending `user_invitations` row
  is closed (status ŌåÆ accepted) whenever the corresponding student account
  becomes active by ANY creation path, not only via `accept-invitation`. Manual
  accounts are delivered as a temp password and the student signs in directly
  (never calling `accept-invitation`), so the one row that used to flip
  pendingŌåÆaccepted never ran ŌĆö leaving a stale pending invitation that kept
  rendering under "Pending invitations" while the account was already active.
  Three layers now close it:
  1. `reconcilePendingInvitations(admin, { email, userId, invitationType })` in
     `supabase/functions/_shared/invitations.ts` ŌĆö idempotent UPDATE
     (already-accepted ŌåÆ no-op), logs a structured `student_invitation_reconciled`
     event (never logs tokens/passwords), non-fatal on error. Called after
     account creation/case-linking in: `create-student-from-case` (manual main
     path + the already-activated invite branch + the linked-account early
     returns, both manual & invite) and `create-student-standalone` (after
     role/profile/case-link).
  2. DB trigger `trg_reconcile_student_invitations` (migration
     `20260813150000_reconcile_student_invitations.sql`) ŌĆö SECURITY DEFINER
     `AFTER INSERT ON user_roles` where role='student', joins
     `profiles.email` ŌåÆ `user_invitations.invited_email` (lower-cased),
     type='student', status='pending' ŌåÆ accepted. Idempotent, no recursion
     (updates a different table), no RLS weakening. Covers ANY path that
     provisions a student role without going through the edge functions.
  3. Same migration runs a one-time idempotent data cleanup closing existing
     stale pending student invitations whose email already belongs to an active
     (non-deactivated) student account (correlation from
     `supabase/diagnostics/account_lifecycle_audit.sql` query 7). pendingŌåÆaccepted
     only, never DELETE. A verification SELECT is kept in a comment.
- **Frontend safeguard** (`src/lib/studentInvitations.ts`): pure
  `filterActiveInvitations(invitations, students)` hides any pending invitation
  whose email (trim+lowercase) matches an active student ŌĆö defense-in-depth if
  DB reconciliation hasn't run yet (replication lag). `TeamStudentsPage` derives
  `visibleInvitations` via `useMemo` and renders that. The active-students query
  DROPPED `.is("case_id", null)` so a manually-created student linked to a case
  appears under active accounts (was previously hidden ŌåÆ vanished from both
  sections); `.not("created_by", "is", null)` stays to scope to staff-created
  accounts. The page refetches both lists on window `focus` (post-activation
  navigation) and after `submitCreate` (already did `Promise.all`).
- `check-email-availability` (edge function, admin/team_member only): returns
  `{ available, existing_role, deactivated }` for an email. A *pending*
  invitation with no account is NOT "taken" (so resends to never-activated
  invitees still work). The frontend debounces this via
  `src/lib/checkEmailAvailability.ts` in three forms:
  `ProfileCompletionForm`, `SubmitNewStudentPage`, and `CaseProfileForm` block
  advancing/saving when the email is taken (or still being checked), with the
  `errEmailTaken` / `case.profile.errEmailTaken` / `case.profileForm.errEmailTaken`
  locale keys (en + ar). Editing an existing case skips its own email
  (`ownEmail`) so re-saving a profile doesn't flag itself.

## Authoritative data flow (never trust the client for money)
- Totals come from the `get_case_financials` RPC (server-side). The frontend never
  re-adds prices.
- Service prices are frozen into `case_services` by `set_case_services` at selection
  time (`catalog_version` + `unit_price` snapshot).
- DARB amount is never entered manually; Germany (EUR) payments are admin-verified
  via `review_case_payment_proof`.

## Clearing profiles.must_change_password (security invariant)
- To clear `profiles.must_change_password` from ANY client flow (student, agent,
  partner, or admin), always call the RPC `clear_must_change_password()`. Never
  issue a direct `.from('profiles').update({ must_change_password: ... })` — the
  `restrict_profiles_write` trigger rejects non-admin writes with
  "Non-admin users cannot change must_change_password". The RPC is SECURITY
  DEFINER and scoped to `auth.uid()`, so it works for admins too.
- A vitest guard (`src/lib/mustChangePasswordGuard.test.ts`) fails the suite if
  any source file reintroduces a direct write to the column.
- Migration `20260901000000_reassert_clear_must_change_password.sql` re-asserts
  the RPC verbatim so an out-of-order re-run of an older migration cannot leave
  the RPC dropped while the trigger stays strict.

## Build / test
- `npm run build` → `vite build` ONLY. **It does not typecheck.** `vite` type-strips,
  so a file may declare a symbol and fail to export it and still produce a bundle.
  Earlier revisions of these notes claimed `npm run build` was `tsc && vite build`
  and that this was "the real gate" — that was never true, and the belief has now
  caused the same class of bug to reach `main` twice (see the `f03c73d` entries).
- `npm run typecheck` → `tsc --noEmit` (root `tsconfig.json`, covers `src/**`).
  **Run this by hand — `vitest` passing is NOT sufficient.** It is also a
  blocking step in `.github/workflows/ci.yml`'s `quality` job as of 2026-09-29.
- `npm test` → vitest (unit tests).
- `npm run test:e2e` → Playwright.
- eslint is not part of the build and its CI step is `continue-on-error: true`,
  so a lint-only failure (e.g. `no-self-assign`) ships.

## i18n
- Namespaced under `dashboard` in `public/locales/{en,ar}/dashboard.json`. The Finance
  keys live under `finance.*`. Components pass inline English fallbacks via
  `t("key", "fallback")`, so missing keys still render. When adding keys, update both
  `en` and `ar`.
- A vitest guard (`src/lib/i18nKeys.test.ts`) fails the suite if any `t("a.b")` key
  used in source is missing from BOTH locale dictionaries of the component's namespace.
  Always add new keys to `en` and `ar` together.
- Student Fees keys live under `studentFees.*`; student status labels under
  `student.status.*` (not `partner.status.*`, which leaks partner wording).

## Student dashboard emergency-contact single source of truth
- Canonical fields: `emergency_contacts` (jsonb array of `{name,relationship,phone}`)
  plus mirror columns `emergency_contact_name` / `emergency_contact_phone` (legacy
  single column `emergency_contact` is kept in sync for older readers).
- `StudentOnboardingGate` writes all three. `StudentProfile` (student-facing) also
  writes all three (name + phone inputs ŌåÆ array + mirrors), so filling the contact on
  the Profile page satisfies the Next Steps completeness check
  (`emergency_contact_phone`). `StudentNextStepsPage` reads `emergency_contact_phone`.
- Admin (`AdminStudentsPage`) and team (`ProfileCompletionForm`, `SubmitNewStudentPage`)
  read/write the same mirror columns, so keep them populated.

## Dashboard / spreadsheet audit conventions
- **Service fee is authoritative from `case_services`** (sum of
  `unit_price * quantity - discount`), never the `case_submissions.service_fee`
  column (frequently 0). Both the Students and Payments spreadsheet sheets use
  `serviceFeeByCase()` from `sheetQueries.ts` so totals reconcile. When adding a
  new money column anywhere, source it from `case_services` / `get_case_financials`,
  not the submission row.
- **Partner commission is a flat ILS amount**, not a percentage
  (see `COMMISSION_RULES.md`). `platform_settings.partner_commission_rate` is the
  global default; per-partner overrides live in `partner_commission_overrides`.
  `DashboardService.financialOverview()` returns `partnerCommissionRate` so the
  Admin Financials overview renders the real rate.
- **KPIs that mirror a capped display list must use a separate `count:'exact', head:true`
  query**, not the list's `.length` (which is capped by `limit()`). `TeamWorkPage`
  does this for overdue-appointments and returned-submissions counts.
- **"Closed" = `enrollment_paid`** (the only terminal success status in
  `TERMINAL_STATUSES` from `lib/caseStatus.ts`). `submitted` is still active
  (awaiting admin review) and must not be counted as closed.
- **SLA thresholds are centralized in `lib/slaPolicy.ts` (`SLA_DAYS`)**.
  `AdminPipelinePage` imports `SLA_DAYS` instead of hardcoding 3/5/14/7 so the
  board never drifts from `AdminCommandCenter` / `isSlaBreached()`.
- **Analytics must exclude archived cases** (`.eq('archived', false)`) to match
  the Pipeline board / Command Center universe.
- **Export scope**: SpreadsheetHub exports the filtered+searched rows (matches the
  visible table). `AdminInboxPage` CSV exports the `visible` (filtered) set.
  `PayoutsManagement` XLSX/PDF exports ALL payout requests (a complete report,
  not the filtered "Other requests" tab) ŌĆö this is intentional.

## pg_cron ŌåÆ Edge Function dispatch auth pattern
- Edge Functions that mutate state for other users gate on `requireAuth(req, ["admin"])`
  (`supabase/functions/_shared/auth.ts`), which rejects the anon JWT (it's public)
  and only accepts the service-role key or an admin JWT. A pg_cron job that
  passes the anon JWT in an `apikey` header therefore 401s on every firing and
  logs "Missing bearer token" in `auth_failure_log`.
- All cron-dispatched Edge Functions MUST be scheduled via a tracked
  `SECURITY DEFINER` wrapper (`public.dispatch_<name>()`) that reads the vault
  secret `email_queue_service_role_key` and POSTs with
  `Authorization: Bearer <secret>`. Never inline the vault read in the cron
  command directly (the cron role may lack vault grants; the wrapper also lets
  us `RAISE WARNING` on a missing secret instead of silently sending a NULL
  Authorization header). Mirror `20260813010000_schedule_appointment_reminders_cron.sql`.
- Each such migration must idempotently `cron.unschedule` the canonical jobname
  AND sweep `cron.job` for orphans whose `command` targets the function URL
  (catches stale out-of-band jobs created under a different jobname), then
  reschedule guarded against duplicates.
- `send-appointment-reminders` (jobname `send-appointment-reminders`, `*/5 * * * *`)
  and `admin-weekly-digest` (jobname `admin-weekly-digest`, `0 8 * * 1`) are
  persisted this way. The appointment-reminders job is NOT self-disarming
  (appointments become due as time advances); the push/email queue dispatchers
  ARE self-disarming (they unschedule when the pgmq queue is empty).


## Student onboarding wizard + passport_number removal (2026-08-13)
- `src/components/student/StudentOnboardingGate.tsx` is a 4-step forced post-login wizard (Personal, Study & arrival, Legal & identity, Emergency contacts) collecting EVERY field the admin sidebar shows in AdminStudentsPage (PROFILE_SELECT), EXCEPT `passport_number`. Each step persists its own slice to `profiles` on Next, so a student can leave/resume; `load()` resumes at the first incomplete step via module-level `stepComplete`.
- `isProfileComplete()` now requires: full_name, phone_number, date_of_birth, gender, nationality, city, country, university_name, intake_month, arrival_date, passport_expiry, eye_color + 2 emergency contacts. Optional legal switches (changed_legal_name/criminal_record/dual_citizenship) are NOT required; when a switch is off its detail field is nulled on save (same pattern as `StudentVisaPage.saveLegal`).
- `passport_number` removed from ALL app read/write/display paths: StudentOnboardingGate(+test), StudentNextStepsPage, StudentProfile, AdminStudentsPage (PROFILE_SELECT/StudentRecord/editForm/handleSave/edit-form array/read-view rows), ProfileCompletionModal (cases table), sheetQueries + SpreadsheetHub (submission extra_data export column), AdminSettingsPage placeholder, src/types/profile.ts, src/types/database.ts (StudentCase). DB columns on `profiles` and `student_cases`/`cases` were LEFT IN PLACE (no drop migration) ŌĆö only app usage stopped.
- `src/integrations/supabase/types.ts` (generated) KEEPS `passport_number` on purpose: it mirrors the live retained DB columns; `supabase gen types` would re-add them, so removing is non-durable and diverges from schema. No code reads those generated fields now.
- Orphaned locale keys (`profile.passportNumber`, `admin.ready.passportNumber`, `sheets.col.passportNumber`) LEFT in en/ar for i18n parity ŌĆö `src/lib/i18nKeys.test.ts` only flags missing keys, not orphans. `passportType` keys are a DIFFERENT concept (passport-type dropdown) and remain in use. `myData.identityDesc` + `student.next.completeProfileDetail` copy updated to drop "passport number".
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 278/278 pass incl. i18nKeys parity guard + onboarding test.

## Student sidebar regrouped into collapsible sections (2026-08-13)
- The student sidebar (and mobile bottom nav) was restructured from 10 flat top-level
  items into 5 intentional destinations: **Next Steps** (top-level), **Study File**
  (collapsible: Checklist/Documents/Visa/Fees), **Communication** (collapsible:
  Messages/Contacts), **My Account** (collapsible: Profile/My data), **Refer**
  (top-level). Admin/team/partner roles keep their existing flat `group`-heading
  layout unchanged.
- `NavItem` (in `src/components/layout/DashboardLayout.tsx`) gained an optional
  `children?: NavItem[]`. Parents with children render as a Radix `Collapsible`
  (`@/components/ui/collapsible`) with `SidebarMenuSub`/`SidebarMenuSubButton`
  children; leaf items render as before. `SidebarNav` keeps `openGroups` state and
  auto-expands ONLY the group whose child route is active on route/role change
  (collapses the rest). In collapsed-icon mode, sub-items are hidden.
- `NAV_CONFIG.student` group parents use `key: "nav.group.studyFile|communication|account"`
  (i18n keys under `nav.group.*` in en/ar `dashboard.json`) with `href: ""` (ignored for
  parents). Added `nav.group.studyFile/communication/account/referral` to both locales.
- `MobileBottomNav` student config mirrors the 5 top-level destinations; grouped parents
  link to their first child route and stay active while ANY child route is open (via
  `groupChildHrefs` map).
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 286/286 pass incl.
  i18nKeys parity guard.

## Context-aware Important Contacts (2026-08-13)
- Students no longer see ALL `important_contacts` rows. Each contact has a
  `scope` ('universal' | 'school_city' | 'school_only' | 'city_only'), a
  nullable `language_school_id` FK ŌåÆ `schools(id)`, and `is_universal`.
  Matching is data-driven ŌĆö no school/city names hardcoded in React.
- Migration: `20260813120000_context_aware_important_contacts.sql` adds the
  columns + CHECK constraints (scopeŌćöis_universal, school required for
  school_* scopes, city required for city/school_city), backfills every
  existing row to `scope='universal', is_universal=true` (no behaviour change
  until admin re-scopes), and creates the SECURITY DEFINER RPC
  `get_student_important_contacts()` (granted to `authenticated` only).
- **Single source of truth**: the RPC resolves the student's active school
  (auth.uid() ŌåÆ most-recent non-deleted case ŌåÆ `case_submissions.school_id`
  ŌåÆ `schools.city`, falling back to `cases.city`) and returns ONLY the
  applicable active contacts, deduped by id, with a `match_scope` tag
  ('universal'|'school'|'city'|'school_city') for grouping. The student page
  just renders what the RPC returns.
- **Security/RLS**: students canNOT `SELECT important_contacts` directly ŌĆö
  the broad "roled/authenticated users read active contacts" policies were
  DROPPED. Students reach contacts only through the RPC (which filters by
  auth.uid()). Admins keep full CRUD ("Admins manage important contacts").
  This closes the leak where any student could `select *` and see every
  school's contacts.
- `src/lib/importantContacts.ts` mirrors the SAME matching rules in a pure TS
  predicate (`matchContact` / `filterContactsByContext`) for unit-testability
  without a DB and admin preview. If targeting changes, update BOTH the SQL
  RPC and this predicate. Vitest (`importantContacts.test.ts`) covers the 8
  acceptance cases (FU Heidelberg, GO Heidelberg, FU other-city, no school,
  disabled contact, new school+city, new universal, duplicate-once).
- `StudentContactsPage` switched from `.from('important_contacts').select()`
  to `.rpc('get_student_important_contacts')`, groups by `match_scope`
  (Emergency & Essential / Your Language School / Your City), and shows empty
  states. Reloads on focus/user change so a school/city change reflects.
- `AdminSettingsPage` contacts tab now has a scope selector + school dropdown
  (active schools) + city (datalist of known cities), scope-aware validation,
  filters (scope/school/city/category/status), search, Scope badge, and
  Edit/Duplicate/Enable-Disable/Delete actions. Edit reuses the same dialog
  (tracked by `editingContactId`).
- Generated `types.ts` updated: `important_contacts` Row/Insert/Update gained
  `scope`, `language_school_id`, `is_universal` + the `schools` FK
  relationship; added the `get_student_important_contacts` function signature.
- Build/test: `npm run build` clean; `npx vitest run` 296/296 pass incl. the
  new 10 contact-matching tests + i18nKeys parity guard.

## Onboarding school picker + live contacts preview (2026-08-13)
- The wizard's "Language school" step is now a **dropdown of active `schools`**
  (not free text). The student's choice persists as an authoritative FK
  `profiles.language_school_id` (added by migration
  `20260813130000_onboarding_school_picker.sql`), while `university_name` is
  kept in sync as the display name for legacy readers (admin sidebar).
- **Single matching implementation**: the core predicate lives in the
  parameterized RPC `get_school_important_contacts(p_school_id, p_city)`; the
  student resolver `get_student_important_contacts()` delegates to it
  (resolving the student's school from `case_submissions.school_id`, falling
  back to `profiles.language_school_id` when the case has no school yet ŌĆö so a
  student who just picked a school in onboarding sees the right contacts even
  before a case/submission exists). Both RPCs are SECURITY DEFINER, granted to
  `authenticated` only.
- On school selection the wizard calls `get_school_important_contacts` and
  renders a compact live preview (universal + school/city contacts) inline,
  so the student immediately sees the data that applies to their school. The
  preview uses the SAME RPC as the real Important Contacts page ŌĆö no logic
  duplicated.
- `StudentOnboardingGate`: `university_name` task switched to type
  `school-select`; `ProfileShape`/`EMPTY_PROFILE`/`SELECT_COLUMNS`/`stepPatch`
  gained `language_school_id`; active schools fetched in `load()`; preview
  fetched via effect on `language_school_id` change (cancelled on cleanup).
  Auto-focus skips `school-select` (it's a Radix Select, not an input).
- Generated `types.ts`: `profiles` Row/Insert/Update gained
  `language_school_id` + the `schools` FK relationship; added the
  `get_school_important_contacts` function signature.
- i18n: new `studentOnboarding.selectSchool` / `.schoolContacts` /
  `.schoolContactsHint` / `.noSchoolContacts` / `.schoolLoading` keys (en+ar).
- Build/test: `npm run build` clean; `npx vitest run` 296/296 pass.

## Onboarding wizard UI/UX redesign (2026-08-13)
- **UI-only redesign** of `StudentOnboardingGate`. The task model (16 TASKS, 4
  steps), `ProfileShape`, `SELECT_COLUMNS`, `isProfileComplete`,
  `stepComplete`, `taskErrorFor`, `load()`, `persist()`, `stepPatch()`, `next()`
  validation, `back()`, `cleanedContacts()`, the school-select + live
  contacts-preview logic, and per-step persistence are all UNCHANGED ŌĆö only
  the visual shell and per-step copy changed.
- New reusable **`OnboardingShell`** (`src/components/student/OnboardingShell.tsx`)
  owns layout only: header (back + mono "03 / 16" step counter), journey
  progress (origin stamp ŌåÆ dashed track ŌåÆ plane marker at the REAL completion
  % ŌåÆ destination stamp), section-context row (current section gold/mono +
  "X next" faint), content slot (editorial headline + short explanation +
  field), and footer slot (secondary Back + full-width brand Continue +
  "N steps to go ┬Ę Saved automatically"). It is presentational ŌĆö no state.
- Theme: the reference's dark aesthetic was ADAPTED, not copied. The app
  defaults to light (`defaultTheme="light"`, `enableSystem={false}`); student
  routes follow the persisted `darb-theme` pref, so the shell uses semantic
  tokens (bg-background, text-foreground, border-border, bg-brand /
  text-brand-foreground) that work in BOTH light and dark. The reference's
  gold maps to the existing `--brand` DARB orange. No new fonts imported
  (Tajawal/IBM Plex Sans Arabic stay) ŌĆö no serif, for performance + brand
  consistency.
- RTL: journey track uses CSS logical `insetInlineStart` for the plane marker
  position so it flips automatically in Arabic; icons use `rtl:rotate-180`;
  layout uses logical properties throughout.
- Per-task friendly headlines + short explanations via new
  `studentOnboarding.q.<key>` / `.q.<key>Desc` keys (en+ar, 88 keys each, parity
  confirmed) with inline English fallbacks. Switch-legal detail fields fall
  back to the flat label (no misleading copy).
- "Saved automatically" + "N steps to go" are ACCURATE: the wizard persists per
  step on advance, and the remaining count is derived from `TASKS.length`.
  No fake time estimates (per spec).
- Removed now-unused imports (Card/CardHeader/CardTitle/CardContent, Progress).
  The `fade-in` keyframe (already in tailwind config) drives the step
  transition; reduced-motion respected.
- Build/test: `npm run build` clean; `npx vitest run` 296/296 pass (incl.
  i18n parity guard + onboarding `isProfileComplete` tests).

## Onboarding wizard: arrival-date picker, nationality default, structured address (2026-08-13)
- **Arrival date now uses the same segmented Year/Month/Day picker as the
  birthday field.** `BirthdayPicker` gained an optional `years?: string[]`
  prop (defaults to `DOB_YEARS`); the wizard passes `ARRIVAL_YEARS` (current
  year ŌåÆ +6) for the `arrival_date` task (new task type `arrival-date`). The
  old plain `<Input type="date">` is gone from this field; `passport_expiry`
  (step 2) still uses the native date input.
- **Nationality defaults to "Israel"** for new students
  (`DEFAULT_NATIONALITY` seeded into `EMPTY_PROFILE`), but the field stays a
  free-text input the student can edit.
- **Home address broken into Street + House number + City.** New task type
  `address` (key `country`, step 0) renders three inputs. New `profiles`
  columns `street`, `house_number`, `residential_city` (nullable text,
  migration `20260813140000_structured_address.sql`). On save, `stepPatch(0)`
  derives the legacy combined `country` string as `"Street House, City"` so
  every existing reader (AdminStudentsPage "Address / Country", StudentProfile
  `home_address`) keeps working unchanged.
- **Backward compat:** `isProfileComplete`/`stepComplete(0)` use a `hasAddress`
  helper ŌĆö complete when (street + house_number + residential_city) OR the
  legacy `country` is filled ŌĆö so existing students who only filled the old
  single text field are NOT re-gated by the wizard.
- `types.ts` (Row/Insert/Update) + `src/types/profile.ts` gained the 3 columns;
  `SELECT_COLUMNS` fetches them; `labelKeyFor`/`labelFallbackFor` map them;
  `taskErrorFor` validates the 3 fields together. New i18n keys
  `studentOnboarding.street` / `.houseNumber` / `.residentialCity` (en+ar, 91
  each, parity).
- Build/test: `npm run build` clean; `npx vitest run` 299/299 pass (incl. 3 new
  address tests: structured-only complete, incomplete structured rejected,
  legacy country backward compat).

## Lebenslauf/CV Builder overhaul (2026-08-13)
- The public CV Builder (`/resources/lebenslauf-builder`, `LebenslaufBuilder.tsx`)
  was overhauled into a full-featured, design-customizable, auto-saving tool with
  4 templates, 12 sections, WCAG-AA-safe colors, and clean print/PDF output.
- **4 templates** (`CVPreview.tsx` routes by `data.template`):
  `german-standard` (tabular, photo left), `academic` (research-focused,
  publications/research front-loaded), `europass` (EU grid, language passport
  grid), `modern-sidebar` (2-column with colored sidebar ŌĆö NEW 4th template).
  Each lives in `src/components/lebenslauf/templates/` and consumes the SAME
  `CVData` shape + design CSS vars ŌĆö no per-template data divergence.
- **Design system** (`cvDesign.ts`): `COLOR_PRESETS` (6 presets: Classic Black,
  Academic Navy, Modern Petrol, Forest Academic, Burgundy Academic, Minimal
  Slate), `TYPOGRAPHY_PRESETS` (Professional/Minimal), `FONTS` registry, spacing
  presets (compact/normal/relaxed). `safeAccentOnWhite()` darkens any accent
  until it passes WCAG AA (>=4.5:1) on white ŌĆö a too-light accent NEVER reaches
  the preview. `designVars()` emits the CSS custom properties
  (`--cv-accent`, `--cv-font`, `--cv-heading-font`, `--cv-date-font`,
  `--cv-spacing-root`, etc.) that all 4 templates consume. Unit-tested in
  `cvDesign.test.ts` (16 tests: color safety, luminance, contrast, presets,
  font-stack fallback, createEmptyCVData shape).
- **12 sections** (canonical order in `ALL_SECTIONS` / `sectionOrder`):
  personal, profile, education, experience, projects, publications, awards,
  skills, certificates, volunteer, references, signature. New sections vs the
  old builder: **Profile** (short bio), **Projects** (`ProjectEntry`), **Awards**
  (`AwardEntry`), **Signature** (none/line/image + place/date). Skills gained
  `interests` (string array). Education gained progressive advanced fields:
  program, focus, grade, expectedGraduation, coursework, achievements, thesis
  (toggled via "Advanced fields" per entry ŌĆö progressive disclosure).
- **Bullets**: experience/projects/volunteer entries store a `bullets: string[]`
  array (one bullet per line in a textarea, split on newlines). Rendered via the
  shared `<Bullets>` helper in `templateHelpers.tsx`.
- **Shared render helpers** (`templateHelpers.tsx`): `<Bullets>`,
  `<SectionHeading>`, `<SignatureBlock>`, `clean()` (trim/empty-filter),
  `dateRange()` (fromŌĆōto / Present). All 4 templates import these so rendering
  is consistent and DRY.
- **Labels** (`cvLabels.ts`): section/field labels in de/en/ar. The label
  dictionary is the SINGLE source for preview headings ŌĆö the content language
  (`data.contentLanguage`) selects which language's labels render, independent
  of the UI language. New keys: profile, projects, awards, interests, thesis,
  grade, expectedGraduation, signature, place, date, website,
  professionalTitle (all in de/en/ar).
- **Auto-save/restore** (`useLebenslauf.ts`): drafts persist to
  `localStorage` under `darb-cv-draft` with a 30-min inactivity expiry (matches
  the draft auto-save pattern from commit `39c2970`). On mount, the hook
  restores the draft if it exists and hasn't expired; otherwise it seeds
  `createEmptyCVData()`. A `lastSaved` timestamp + dirty flag drive the
  "Saved / Unsaved changes" status indicator. `clearDraft()` wipes the key.
  The hook exposes `{ data, setData, updatePersonal, updateData, updateDesign,
  updateSignature, errors, validate, saveDraft, loadDraft, clearDraft,
  draftStatus }`.
- **Validation** (`LebenslaufBuilder.tsx`): a `validate(data, t)` function
  (called outside of hooks to avoid rules-of-hooks violations) checks
  required fields (first name, last name, email format) and date ranges
  (from Ōēż to). Errors render inline under the offending field and block
  "Download PDF" until resolved.
- **Print/PDF** (`src/styles/cv-print.css`): the old `position: fixed` preview
  container (which clipped multi-page CVs to one printed page) was removed.
  The print stylesheet now uses normal flow with `@page` margins,
  `break-inside: avoid` on entries, and page-break-before on major sections.
  "Download PDF" calls `window.print()` (the user picks "Save as PDF"); the
  on-screen preview is A4-proportioned so what you see is what prints.
- **i18n parity**: all new UI keys live under `lebenslaufBuilder.*` in
  `public/locales/{en,ar}/resources.json` (the builder uses the `resources`
  namespace). The vitest `i18nKeys.test.ts` parity guard passes ŌĆö every
  `t("lebenslaufBuilder.*")` key used in source exists in both en and ar.
  Inline English fallbacks (`t("key", "fallback")`) ensure missing keys still
  render.
- **Mobile**: `LebenslaufBuilder` has an Edit/Preview toggle on small screens
  (shows one at a time); on desktop both render side-by-side.
- Build/test: `npm run build` clean; `npx vitest run` 343/343 pass
  (incl. 16 new cvDesign color-safety tests + i18nKeys parity guard). ESLint:
  0 errors across all lebenslauf files (5 `react-refresh/only-export-components`
  warnings in `templateHelpers.tsx` are pre-existing pattern, not build-gated).

## Student Overview command-center + visa/documents permissions (2026-08-14)
- `StudentOverview.tsx` is a SHARED component (variant `"page"` for team,
  `"sheet"`-like for admin via the `tabs` prop). Layout is fixed topŌåÆbottom:
  **Student information** (identity header with a compact key-facts grid:
  name, case ref, email, phone, language school, program, assigned team
  member, case status) ŌåÆ **Case progress** rail ŌåÆ **Next action + Financial
  snapshot** (two columns) ŌåÆ **Detail tabs** (Personal / Contact / Visa /
  Documents). Recent activity was REMOVED from the overview (it lives on the
  case-detail timeline; `useCaseEvents`/`CaseTimeline` imports dropped). The
  header resolves `assigned_to ŌåÆ profiles.full_name`, `submission.program_id
  ŌåÆ programs.name_en/ar`, and `profiles.language_school_id ŌåÆ schools` (only
  when `university_name` isn't already the synced display name) in ONE effect.
- **Next action only surfaces UNFINISHED work**: terminal states
  (`enrollment_paid`, `cancelled`) return `null` ŌåÆ no next-action card. The
  `submitted` prepare-visa branch no longer fires for `enrollment_paid`.
- **Visa permissions (enforced at the DB, not just UI)**: migration
  `20260814000000_student_overview_visa_docs.sql` REPLACES the team
  `FOR ALL` "Team manage assigned visa values/applications" policies with
  SELECT-only "Team read assigned visaŌĆ”" policies. Team can read their
  assigned students' visa but CANNOT write it (matches the read-only
  `VisaReadOnly` fallback already rendered for team). Admin keeps full
  `FOR ALL`; student INSERT/UPDATE unchanged.
- **Admin visa edit now requires re-auth**: `AdminStudentsPage` gates the
  visa "Edit" button behind `AdminPasswordConfirm` (verify-admin-password
  edge function, server-side password check) ŌĆö `visaConfirmOpen` state;
  `onConfirmed` sets `visaDraft` + `editingVisa=true`. The `Edit` button no
  longer opens edit mode directly. New i18n key `admin.students.visaConfirmReason`.
- **Team can now upload documents**: `TeamStudentProfilePage` passes
  `renderDocumentsTab={() => <DocumentsPanel studentId caseId actorUserId
  canDelete={false} />}` (it previously had NO documents tab at all).
  `actorUserId` is resolved from `supabase.auth.getSession()`. The shared
  `DocumentsPanel` stamps `uploaded_by = actorUserId`, `case_id = caseId`,
  `is_visible_to_student = true` on insert, reuses `validateUploadFile` +
  `documents.*` i18n + the `student-documents` bucket + signed-URL download
  (same path as the student `DocumentsManager`). Team `canDelete=false` (RLS
  has no team UPDATE/DELETE on documents). Admin keeps its existing inline
  documents UI (its own realtime + soft-delete) ŌĆö DocumentsPanel is the
  team path; both back the SAME `documents` table.
- **Document-upload notification (reuse, not new infra)**: the same migration
  adds a SECURITY DEFINER trigger `trg_student_document_added` (AFTER INSERT
  ON documents) ŌåÆ `notify_student_document_added()`. It inserts an in-app
  `notifications` row (source `'document_added'`, bilingual title/body naming
  the actor + file, `case_id` link) ONLY when `uploaded_by` is a staff member
  (not null, not the student) and `is_visible_to_student`. Student
  self-uploads never notify. This mirrors the existing trigger pattern
  (`notify_student_profile_update`, `notify_case_status_change`) ŌĆö no new
  notification infrastructure. Email is NOT wired for this event (no template).
- **Financial snapshot discount**: `FinancialSnapshot` already sources from
  `get_case_financials` (the authoritative RPC; `service_total` is NET of
  `referral_discount`). The discount row is now an emerald
  `bg-emerald-500/10` line with `ŌłÆ Referral discount` / `ŌłÆ ž«žĄ┘ģ ž¦┘äžźžŁž¦┘äž®`, shown
  only when `referral_discount > 0`; the net total is labeled "Final total"
  (`studentOverview.finalTotal`). Math reconciles: `service_total +
  referral_discount` (original) ŌłÆ `referral_discount` = `service_total`.
- **i18n**: new `studentOverview.*` keys (`details`, `languageSchool`,
  `program`, `assignedTeamMember`, `caseStatus`, `finalTotal`,
  `documentsHint`) + `admin.students.visaConfirmReason` added to en + ar
  (parity guarded by `src/lib/i18nKeys.test.ts`). Contact tab "University" ŌåÆ
  "Language school" / "┘ģž»ž▒ž│ž® ž¦┘ä┘äž║ž®".
- Build/test: `npm run build` clean; `npx vitest run` 343/343 pass. New files
  lint clean (`DocumentsPanel.tsx`, `TeamStudentProfilePage.tsx`);
  `StudentOverview.tsx` keeps its pre-existing `no-explicit-any` notes.

## Case/direct chat scroll-to-newest on open (2026-08-14)
- `src/components/messages/MessageList.tsx` is the dashboard case/direct chat
  list (NOT the AI advisor `ChatMessageList`/`useAIChat` popup, which is a
  separate stack that scrolls on every message change).
- The old on-mount `useEffect([])` "land on newest" scroll fired while the
  parent (CaseMessages/DirectMessages) was still loading; during loading
  MessageList returns the skeleton branch early so `bottomRef` was NOT in the
  DOM and `scrollToBottom()` was a no-op. After messages loaded that effect
  never re-ran; only the `lastId` effect fired, which uses "smooth" + an
  `isNearBottom()` gate that can land short when message rows change height
  after layout.
- Fix: the initial scroll is now anchored to **loading finishing + messages
  present**, not mount. A `didInitialScroll` ref makes it a one-shot per
  opened thread, and it uses `scrollToBottom("auto")` (instant, not smooth)
  wrapped in `requestAnimationFrame` so the full list paints first ŌĆö the
  landing can't be interrupted by layout shifts (avatars/attachments/day
  dividers). An effect on `[firstId]` (declared BEFORE the land effect so it
  wins the same-commit ordering on a thread switch) resets the flag so a
  reused MessageList instance still jumps for a new thread.
- The `lastId` follow-on effect (smooth scroll when near bottom OR own
  message, else show the jump button) is UNCHANGED ŌĆö reading older history
  is never yanked down; the "jump to latest" button + near-bottom follow
  logic are preserved. Presentational scroll fix only; no changes to
  CaseMessageService, RLS, realtime, or the composer.
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 343/343 pass.


## Route / role consolidation ŌĆö partner apply, manager tier, master-ambassador (2026-08-14)

- **Roles** (unchanged enum): admin, team_member, social_media_partner, ambassador, student. "Manager" and "master partner" are NOT enum values ŌĆö they are flags on profiles (is_manager on a team_member; is_master_partner on a partner/ambassador), admin-only settable (the restrict_profiles_write trigger blocks non-admins from changing either).

### De-duplicated partner/ambassador nav
- DashboardLayout.tsx: a single PARTNER_BASE_NAV const holds the shared partner/ambassador sidebar entries. social_media_partner (lawyers) appends an Apply item (/partner/apply); ambassador (influencers) keeps the referral-link-only set (no Apply). MobileBottomNav.tsx mirrors this via PARTNER_MOBILE_NAV (4 tabs ŌĆö Apply is a full-page flow, not a daily tab). The two roles no longer duplicate an identical nav block.
- Master-partner nav injection (useIsMasterPartner) now fires for BOTH social_media_partner and ambassador (was partner-only), adding /partner/network + /partner/performance. The master toggle in AdminTeamPage (MasterPartnerToggle) also now renders for ambassadors.

### Manager tier (team_member + is_manager)
- useIsManager() hook reads profiles.is_manager (team_member only).
- DashboardLayout injects a Pipeline item (/team/pipeline) into the team sidebar ONLY for managers. Non-managers keep the assigned-only view.
- TeamPipelinePage (/team/pipeline): lists cases that arrived via a partner/ambassador referral (cases.partner_id IS NOT NULL, active non-terminal) and lets the manager assign each to a team member via a Select. It is a focused assignment surface ŌĆö NO catalog/settings/delete. Non-managers are bounced to /team. Team members are listed via the SECURITY DEFINER RPC list_team_directory() (id + full_name only ŌĆö team members cannot SELECT arbitrary user_roles/profiles rows by RLS).
- RLS (migration 20260814120000_manager_pipeline_partner_apply.sql):
  - is_active_manager(uid) helper (team_member + is_manager + not deleted).
  - cases: "Manager can view active cases" (SELECT, non-archived) and "Manager can assign cases" (UPDATE OF assigned_to only, WITH CHECK re-validates the manager flag). Both ADDITIVE ŌĆö the existing "Team can manage assigned cases" (FOR ALL, assigned_to = self) stays, so a manager who is also assigned a case keeps full team access to it. A manager can ONLY change assigned_to; status/partner_id/referral fields stay admin/team as before.
  - get_my_permissions() now ORs-in view_cases/assign_cases/view_students when is_active_manager, so the UI can gate the nav on a clean flag. The manager set deliberately EXCLUDES manage_settings/pipeline/team/partners and deletes ŌĆö those remain admin-only.
  - Manager tier enforcement is in RLS, not client trust.

### In-dashboard partner apply form (single source of truth)
- The 941-line public ApplyPage was split: the multi-step form now lives in src/components/apply/ApplyForm.tsx (shared component), with constants in src/components/apply/applyConstants.ts. ApplyPage is now a 14-line wrapper that renders <ApplyForm /> (public chrome, anon-key submission, its own success screen). No duplicated form code.
- PartnerApplyPage (/partner/apply, social_media_partner only) renders <ApplyForm embedded useSessionAuth onSubmitted={...} />. embedded omits the full-screen chrome/hero/trust badges (renders inside the dashboard shell); useSessionAuth sends the partner session access token in Authorization: Bearer instead of the anon apikey, so the edge function attributes the case to the logged-in partner server-side. Ambassadors are redirected away (no Apply route/nav for them).
- create-case-from-apply edge function: resolveCaller now detects isPartner (social_media_partner/ambassador) from the JWT. After the staff-only partner_id branch and the referral-code resolution, a partner self-attribution branch fills validatedPartnerId from caller.userId (server-derived ŌĆö the client-supplied partner_id is still ignored for non-staff callers, so a partner can never credit a different account) with attributionMethod = "partner_self". A referral code on the request still wins (the partner may be sharing a student ref link).
- Build/test: npm run build (tsc+vite) clean; npx vitest run 343/343 pass.

## Agent backend fixes (2026-08-14)
- **Bulk network split (no more N+1)**: `get_my_agent_network()` now returns an
  `agent_amount` column (the effective per-recruit override, resolved by the
  SAME `get_effective_agent_split` the page used per-row) ŌĆö one RPC replaces the
  old "1 list call + N split calls". Migration
  `20260814150000_agent_backend_fixes.sql`. `AgentNetworkPage` is hybrid: rows
  carrying `agent_amount` render immediately; rows that lack it (old deployed
  RPC) fall back to the background `get_effective_agent_split` loop, so the page
  never shows a wrong/zero rate during the rollout. Generated
  `src/integrations/supabase/types.ts` `get_my_agent_network` Returns gained
  `agent_amount`.
- **agent_relationships is now a real audit trail** (the table existed since
  `20260814140100` but nothing ever wrote to it). The single writer is
  `sync_agent_relationship_row(p_agent_id, p_user_id)` (SECURITY DEFINER):
  deactivates stale links for the recruit, resolves the recruit's role and the
  effective commission server-side, and upserts the live row
  (`ON CONFLICT` matches the partial unique index
  `(agent_id, recruited_user_id) WHERE recruited_user_id IS NOT NULL AND active = true`).
  Triggers: `trg_sync_agent_relationship` on `profiles.agent_id` (attach/detach/reassign),
  and `trg_sync_agent_relationship_on_role` on `user_roles` (covers the ordering
  where a profile with `agent_id` is created before the partner/ambassador role
  is granted ŌĆö accept-invitation ordering). A role downgrade out of
  partner/ambassador deactivates the link (history kept); detaching
  (`agent_id = NULL`) also deactivates, never deletes. Existing agentŌåÆrecruit
  links are backfilled idempotently.
- **Multi-level agent chaining fully closed**: `enforce_agent_graph` (profiles
  trigger, from `20260814140100`) only fires on `agent_id` changes, so a user
  could be granted the 'agent' role AFTER already belonging to an agent's
  network without any trigger firing. New `enforce_agent_graph_on_role` (BEFORE
  trigger on `user_roles`) rejects granting 'agent' to a profile with
  `agent_id` set ŌĆö same invariant as the profiles path.
- **createInvitation is attribution-safe** (`_shared/invitations.ts`):
  - Conflict: a live pending invitation for the same email + type under a
    DIFFERENT recruiter (different `master_partner_id` or `agent_id`) now throws
    `InvitationConflictError` instead of being silently revoked and
    re-attributed. Same-recruiter duplicates (re-invites across cases) are still
    refreshed/revoked as before.
  - Resend preserves attribution: a null incoming `masterPartnerId`/`agentId`
    keeps the existing values instead of wiping them (this is what fixed
    `invite-account` resends killing an agent-recruit's `agent_id`).
  - `agent-invite-recruit`, `invite-account` and `approve-partner-recruit`
    surface `InvitationConflictError` as a 409 with `code: "invitation_conflict"`.
    `approve-partner-recruit` reverts the premature `approved` flip back to
    `pending` (clearing `reviewed_by`/`reviewed_at`) so a conflicted application
    is never stuck "approved without an invite".
- **create-team-member**: `agent_id` is only stamped for
  `social_media_partner`/`ambassador` roles (an agent can never sit under
  another agent ŌĆö `enforce_agent_graph` forbids chaining ŌĆö and a team_member
  belongs to no recruitment network).
- **Frontend**: `identityConflictMessage` (`src/lib/identityConflict.ts`)
  handles `code: "invitation_conflict"` with the new localized
  `admin.team.conflictPendingInvite` key (en + ar). `AgentNetworkPage`'s direct
  invite surfaces it via the same toast path.
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 345/345 pass
  (+2 identityConflict `invitation_conflict` cases; i18n parity guard green).

## Agent cases RLS — agents could not read their own self-referral cases (2026-08-14)
- The `agent` role (added `20260814140000`/`20260814140100`) originally had NO
  SELECT policy on `cases`. The only non-staff SELECT policy was
  "Partners can view their own cases" (`has_role(..., 'social_media_partner')`),
  which an agent does not satisfy. So an agent could not read ANY case row —
  including their own self-referrals (`cases.partner_id = agent`, created via
  the agent's `/apply?ref=<code>` link or the dashboard apply form) and cases
  attributed to the partners/ambassadors in their network.
- Symptom: `AgentStudentsPage` does `.from('cases').in('partner_id',
  [...recruits, ownUid])` directly (subject to RLS), so RLS silently returned
  an empty set and EVERY students tab (All / Via partners / Via ambassadors /
  Your own referrals) showed (0) even right after a successful self-referral
  application. The agent overview KPIs (recruited partners/ambassadors, network
  students, paid cases) were NOT affected because they derive from the
  SECURITY DEFINER `get_my_agent_network()` RPC (bypasses RLS), which returns
  recruits only — self-referral cases are not a network KPI by design.
- Fix: migration `20260814183000_agent_cases_select_rls.sql` adds ONE additive
  SELECT policy "Agents can view network and self-referral cases" scoped via
  `has_role(auth.uid(), 'agent')` to: `partner_id = auth.uid()` (self),
  `referred_by = auth.uid()`, or `partner_id IN (SELECT id FROM profiles WHERE
  agent_id = auth.uid())` (network recruits). Agent-only; no existing policy
  touched. `AgentStudentsPage.classifySource` already maps `partner_id === uid`
  → "self" (Your own referrals tab), so no frontend change is needed once RLS
  is applied.
- **Recursion fix (20260814183100)**: the first migration's inline
  `partner_id IN (SELECT id FROM profiles WHERE agent_id = auth.uid())`
  subquery caused **mutual RLS recursion** → Postgres 42P17 "infinite
  recursion detected in policy for relation cases". Cycle: the cases policy
  reads `profiles`; `profiles` has "Assigned team can view student profiles"
  (reads `cases`); each evaluates the other. The corrective migration moves
  the recruit check into a SECURITY DEFINER function
  `agent_owns_recruit(p_recruit, p_agent)` (reads `profiles.agent_id` WITHOUT
  RLS, breaking the cycle) and rewrites the policy to call it. **Apply this
  migration whenever the base one is applied** — the base one alone leaves
  every agent cases read erroring (worse than empty).
- Verified live: the agent JWT (role=agent) returns `[]` for
  `cases?partner_id=eq.<self>` despite a successfully-submitted
  self-referral case → confirms RLS (not attribution) is the blocker.
  After the base migration was applied without the recursion fix, the same
  query returned `42P17 infinite recursion detected in policy for relation
  "cases"` → confirmed the cycle; after the recursion-fix migration is
  applied it returns the rows.
- **NOTE**: applying these migrations requires Supabase admin/service-role
  access (DDL). It is NOT applied by the Vercel frontend build or the
  `ci.yml` workflow. Run via the Supabase dashboard SQL editor or
  `supabase db push`. The anon/agent JWT cannot run DDL.
- "Your links" card on `AgentOverviewPage`: renamed from "Recruiting link" to
  a single "Your links" card holding BOTH shareable links — the recruiting
  link (`/join/<recruit_code>`, recruits partners/ambassadors) and the
  referral apply form link (`/apply?ref=<referral_code>`, the agent's personal
  student application link). `useAgentOverview` now loads
  `profiles.referral_code` so the page can build the apply URL. Each link has
  its own copy button + independent copied state. i18n keys `yourLinks`,
  `yourLinksHint`, `applyLink`, `applyLinkHint`, `applyLinkMissing` (en+ar).

## Agent recruit wizard + manual-account-creation toggle + ₪500 commission (2026-08-14)
- `AgentRecruitPage.tsx`: the three separate cards (role selection, delivery
  mode + per-recruit commission, recruit details) are merged into ONE wizard
  `Card` titled "Recruit a partner or ambassador" with numbered step headers
  (1: Who are you recruiting?, 2: How should they receive their account? +
  the per-recruit commission line, 3: Recruit details) separated by
  `border-t`. The recruiting-link fallback card stays separate. A new
  `StepHeader` helper renders the numbered badge. All existing submit/delivery
  logic is unchanged.
- **Per-recruit commission line**: the ₪ amount shown is `perRecruitRate`
  (from `agent_commission_overrides` override → `platform_settings.agent_commission_rate`
  global). New i18n `agent.perRecruitRateHint` (en+ar) explains it's earned
  when a student brought by the recruit pays. `agent.perRecruitRate` (ar:
  "عمولة لكل مسؤول تجنيد") is the label.
- **₪500 commission**: migration `20260814190000_agent_commission_rate_500.sql`
  raises `platform_settings.agent_commission_rate` default from ₪200 → ₪500
  and updates the existing row. This is the flat amount the agent earns (carved
  out of the partner pool FIRST via `get_effective_agent_split` →
  `record_case_commission`) when a student referred by a recruited
  partner/ambassador reaches `enrollment_paid`. `get_effective_agent_split`
  still clamps to `LEAST(amount, pool)`, so with the default ₪500 partner pool
  the agent earns the full ₪500 and the referring partner gets the remainder.
  Per-agent overrides still win.
- **Manual account creation toggle**: `profiles.agent_can_create_accounts`
  (boolean, default false, admin-only settable via `restrict_profiles_write` —
  same guard pattern as `agent_can_invite_directly`) now has an admin UI.
  `AgentCreateAccountsToggle` (`src/components/admin/AgentCreateAccountsToggle.tsx`,
  mirrors `AgentInviteToggle`: confirmation AlertDialog, only flips the flag,
  never touches earnings/referral/payouts) renders in `AdminTeamPage` next to
  `AgentInviteToggle` for `role === 'agent'` rows. The page now SELECTs
  `agent_can_create_accounts`, maps it on the member, and updates local state
  on toggle. When an admin enables it, the agent's recruit page "Create
  account manually" delivery card becomes active (no longer disabled) and
  `effectiveMode` can be `manual` → `agent-create-account` returns a temp
  password. New i18n keys under `admin.agents.create*` (en+ar): badge "Manual",
  grant/revoke titles+body+toast, toggle hint.
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 345/345 pass
  incl. i18n parity guard.

## Partner/Ambassador/Agent referral workflow — dashboard visibility fixes (2026-08-14)

End-to-end audit of the "case appears in Admin but NOT in the Partner/Ambassador
dashboard / KPI, and Agent can't see recruited-partner students" bug. Five root
causes found and fixed; none of them were a missing relationship — the hierarchy
(Agent → Partner/Ambassador → Student) and the attribution columns
(`cases.partner_id` / `cases.referred_by`, `profiles.agent_id`) were already
correct. The data was right; the READ paths were broken.

### BUG 1 (CRITICAL): ambassadors were invisible to their own dashboard
- `get_partner_pool_cases` (the SECURITY DEFINER RPC that backs
  `PartnerOverviewPage` / `PartnerStudentsPage` / `PartnerEarningsPage`) gated
  ONLY on `has_role(auth.uid(), 'social_media_partner')`. Ambassadors use the
  SAME `/partner/*` routes and the SAME pages (App.tsx:329, DashboardLayout
  PARTNER_BASE_NAV), so an ambassador (role='ambassador') ALWAYS got an empty
  set — even when a case was correctly attributed
  (`cases.partner_id = ambassador`) and Admin saw it. The ambassador's
  "Students registered" / KPI / case list never updated after a referral.
  This is the exact reported symptom for ambassadors.
- FIX (migration `20260814210000_partner_ambassador_case_visibility.sql`):
  the RPC now accepts BOTH `has_role('social_media_partner') OR
  has_role('ambassador')`. Ownership scoping (`partner_id = auth.uid() OR
  referred_by = auth.uid() OR pool-mode global`) is UNCHANGED — an ambassador
  still only sees their own attributed cases (or the agency pool when enabled),
  never another ambassador's. SECURITY DEFINER + search_path public unchanged;
  no RLS weakened; grant unchanged (`authenticated` only).

### BUG 2 (CRITICAL): referral code dropped on transient verifyReferralCode error
- `src/components/apply/ApplyForm.tsx` called `verifyReferralCode(code)` and, in
  the `.then`, set `refCode(null)` whenever `health.valid === false` — but
  `verifyReferralCode` returns `{valid:false}` BOTH for a genuinely invalid
  code AND for a transient network/RPC error (catch). So a student using a
  partner's referral link whose `check_referral_code` RPC blipped → `ref_code`
  nulled → `create-case-from-apply` received no `ref_code` → case created with
  `partner_id = NULL` → partner dashboard never sees it, KPI never increments,
  Admin sees the unattributed case.
- FIX: `src/lib/referral.ts` `ReferralHealth` gained `unverified?: boolean`
  (true ONLY on the catch/network-error path; the stored code is NOT cleared on
  that path — only on a server-confirmed rejection). New pure helper
  `shouldKeepReferralCode(health)` returns `true` for valid OR unverified.
  `ApplyForm` now keeps the code when `shouldKeepReferralCode` is true and only
  drops it on a server-confirmed rejection. The server resolves the code again
  at submission anyway, so a momentary client-side lookup failure can never
  strip a partner's attribution.
- Tests: `src/lib/referral.test.ts` +5 cases (unverified keeps code, rejected
  drops, shouldKeepReferralCode valid/unverified/rejected/null).

### BUG 3 (CRITICAL): duplicate-phone path dropped partner attribution
- `supabase/functions/create-case-from-apply/index.ts` duplicate-phone branch
  (when an existing contact_form/apply_page case matches the phone) updated only
  the education fields and SILENTLY DROPPED the newly-resolved partner/referrer
  attribution. Scenario: student first applied via contact_form (no partner),
  later re-applies via a partner's referral link → existing case found →
  partner_id stays NULL → partner never credited, student never appears in
  partner dashboard. Admin sees the case (unattributed).
- FIX: new SECURITY DEFINER RPC `backfill_case_attribution(p_case_id,
  p_partner_id, p_referred_by, p_attribution_method)` (in the same migration)
  is ADDITIVE ONLY (sets a column only when it is currently NULL — never
  overwrites, so a later submission can't steal/re-attribute another partner's
  case). The edge function calls it in the duplicate-phone branch. All values
  passed in are already server-resolved (JWT / resolve_referral_code), never
  client-trusted.
- WHY a SECURITY DEFINER RPC (not a direct UPDATE): the
  `restrict_cases_financial_columns` BEFORE UPDATE trigger guards
  `partner_id` / `referred_by` / `source_attribution_method` against non-admin
  writes. A service-role edge-function write has `auth.uid() = NULL` →
  `has_role(NULL,'admin') = false` → the trigger would RAISE on a guarded
  column change. The RPC sets the trusted `app.internal_commission_split` GUC
  (the SAME escape hatch `record_case_commission` uses) before the UPDATE,
  exactly like the commission split. Granted to `service_role` ONLY (revoked
  from anon/authenticated) so no dashboard client can rewrite attribution.
- `types.ts`: added `backfill_case_attribution` signature.
- Diagnostic: `supabase/diagnostics/referral_workflow_audit.sql` flags
  pre-existing orphaned cases (apply/contact, no attribution, phone reused by
  an attributed case) that may need a one-time admin review — the RPC recovers
  going forward, NOT retroactively (same data-caveat pattern as the referral
  discount commission fix; a one-time correction is an operator decision).

### BUG 4: PartnerEarningsPage paid-case names blank (RLS dead-end)
- `src/pages/partner/PartnerEarningsPage.tsx` did a direct
  `.from('cases').select('id,full_name').in('id', caseIds)` to resolve names
  for paid rewards — but after migration `20260806020018` dropped the only
  partner `cases` SELECT policy ("Partners can view their own cases"), there is
  NO direct SELECT policy on `cases` for partner/ambassador roles (they reach
  cases ONLY through `get_partner_pool_cases`). The direct lookup silently
  returned an empty map → paid case names rendered as "—".
- FIX: build `paidCaseMap` from the cases already loaded via
  `get_partner_pool_cases` (the page already fetches them) — no second
  round-trip, no RLS dead-end. (Lower severity: cosmetic name resolution, not
  attribution/KPI; the reward amounts themselves come from the `rewards` table
  which has its own `user_id = auth.uid()` SELECT policy.)

### BUG 5: agent KPI/list basis inconsistency (consistency, not a visibility gap)
- `get_my_agent_network.students_count` used `COALESCE(c.partner_id, c.referred_by)
  = r.id` while `paid_cases` used only `c.partner_id = r.id`. A recruit's id can
  only ever appear in `cases.partner_id` (a partner/ambassador referral resolves
  to partner_id, never referred_by — referred_by is reserved for student-to-
  student referrals), so the COALESCE was a no-op for real recruits but could in
  principle make the KPI count exceed what the agent's cases SELECT policy +
  AgentStudentsPage `.in('partner_id', ...)` filter surface. Aligned
  `students_count` to the same `partner_id` basis used everywhere else.
  Behaviour unchanged for every real recruit.

### What was NOT changed (confirmed correct, not the bug)
- The attribution data flow itself: referral link `?ref=` → `referral.ts`
  (capture + 90-day localStorage) → `ApplyForm` sends `ref_code` in the body →
  `create-case-from-apply` resolves it server-side via `resolve_referral_code`
  (consults `partner_links` then `profiles.referral_code` with
  `referral_code_enabled`, since `20260812100000`) → writes `cases.partner_id` /
  `cases.referred_by` / `cases.source_attribution_method`. Partner dashboard
  self-attribution (`partner_self`) derives from the JWT, never the body.
- The hierarchy: Agent → Partner/Ambassador → Student is intact. Agent
  visibility derives from `profiles.agent_id` (recruits) → `cases.partner_id`
  (their students) via the `agent_owns_recruit` SECURITY DEFINER helper + the
  "Agents can view network and self-referral cases" SELECT policy
  (`20260814183000` + recursion fix `20260814183100`). Direct partner/ambassador
  attribution on `cases.partner_id` is NOT changed by adding agent visibility.
- `record_case_commission` agent carve-out, the ₪500 agent commission rate, the
  agent self-referral rate, commission splits, financials, the case pipeline,
  role enums, and unrelated RLS are all untouched.

### Build/test
- `npm run build` (tsc+vite) clean; `npx vitest run` 350/350 pass
  (+5 referral attribution-preservation tests; i18n parity guard green).
- NOTE: applying `20260814210000` requires Supabase admin/service-role access
  (DDL). It is NOT applied by the Vercel frontend build or the `ci.yml`
  workflow. Run via `supabase db push` or the Supabase dashboard SQL editor.
  The anon/authenticated JWT cannot run DDL.

## Migration-to-Code Reconciliation (2026-08-15)

### DashboardService KPI classification (FIN-01)
- `src/services/DashboardService.ts` classified rewards by free-text
  `admin_notes` prefix ("Partner commission from case…" / "Team commission
  from case…"). Agent self-referral rewards (note "Agent self-referral from
  case…") and master/agent_override shares fell into NEITHER bucket, so
  partner-pool outlay was understated and platform net revenue overstated.
- Fixed: classify by the structured `reward_type` column (authoritative),
  falling back to `admin_notes` prefix only for legacy rows that predate
  `reward_type`. `isTeam` = `reward_type === 'team'`; `isPartnerPool` = any
  non-team reward (partner referral, master share, agent self-referral, agent
  override — all reduce platform margin). Matches the pattern already used in
  `src/components/spreadsheet/sheetQueries.ts`. The rewards query now selects
  `reward_type, recipient_role` alongside the previous fields. Both the
  KPI-level totals and the per-case reconstruction use the same helpers.

### case_payment_proofs.payment_id NOT NULL bug (live fix)
- `submit_german_payment_proof` / `submit_case_payment_proof` insert without
  `payment_id` (a Germany-side proof can arrive before any payment row exists),
  but the live column was `NOT NULL` because the align_darb migration's
  `CREATE TABLE IF NOT EXISTS` was a no-op on the already-existing table.
  Every student proof upload hit a NOT NULL violation.
- Migration `20260815140000_drop_payment_proof_not_null.sql`: drops NOT NULL on
  `payment_id`, recreates `payment_id` FK as `ON DELETE SET NULL` (proof is
  evidence — don't delete it when a payment is removed, just unlink), recreates
  `uploaded_by` FK as `ON DELETE RESTRICT` (was SET NULL on a NOT NULL column,
  which made profile deletion fail with a cryptic violation). Adds a
  deprecation `COMMENT ON COLUMN referrals.discount_applied`.
- `src/integrations/supabase/types.ts` updated: `payment_id` Row →
  `string | null`, Insert → `payment_id?: string | null`.

### Dead code removal (Option B — full pipeline + dead modules)
- Deleted the entire dead dashboard pipeline: `dataService.ts`,
  `useDashboardData.ts`, and the handwritten/stale `src/types/database.ts`
  (sole importer was `dataService.ts`). The authoritative generated types live
  in `src/integrations/supabase/types.ts`.
- Deleted 12 additional dead modules with zero importers (verified via grep):
  `services/CaseCostingService.ts`, `services/CasePaymentService.ts`,
  `hooks/{useCasePayments,usePermissions,useScrollAnimation,useSessionGuard}.ts`,
  `lib/{authFailureLog,conflictPrevention,cost-data,importantContacts,serviceFee,types}.ts`
  plus their 4 test files. `authFailureLog.ts` became dead because
  `dataService.ts` was its only consumer.
- NOTE: `20260815140000` requires Supabase admin/service-role access (DDL).
  Apply via `supabase db push` or the dashboard SQL editor. The frontend build
  and CI do NOT apply DDL.
- Build: `npm run build` clean; `npx vitest run` 320/320 pass (was 350; −30
  tests that only covered deleted dead code).

## Commission System Rebuild — Admin Commission Hub (2026-08-15)

**Objective:** deep audit of the commission/referral/attribution/payout/reward
system, then rebuild Admin commission settings into a single centralized
**Admin Commission Hub** at `/admin/commission`.

### Adopted decisions (authoritative)

- **D1 — ADDITIVE agent model.** The agent receives ₪500 (or their configured
  override) ON TOP of the partner's full ₪1000 pool share. It is NOT carved
  from the partner pool. It is funded from Darb's platform margin:
  `platform_revenue_ils = net − team − pool − agent_share`.
  `get_effective_agent_split` and `record_case_commission` are both the
  additive versions (no `LEAST(amount, pool)` clamp). This matches the live
  code in `20260814182120` / `20260814230457` and Rule 2.
- **D2 — Enforce exclusivity at the Hub.** A single account can be a partner
  OR an ambassador OR an agent OR a master partner — not several. The Hub is
  the one place that edits these relationships.
- **D3 — Margin-funded.** Team commissions and student-referral rewards come
  out of Darb's margin (platform_revenue), like the agent share. They never
  reduce a partner's pool.

### Reconciliation

`COMMISSION_RULES.md §10` previously mandated a **carve-from-pool** model that
contradicted the live additive code. The doc was fixed (not the code): §10 is
now additive, §4 includes `agent_override` + `student_referral_reward` in the
platform_revenue formula, and §11 was added for student referrals.

### Migrations (NOT committed/pushed per user instruction)

All three are idempotent and use unique timestamps (`20260816*`):

1. `20260816000000_commission_hub_schema.sql` — new tables
   (`commission_rate_history`, `student_referral_reward_overrides`) + new
   `platform_settings` columns (`student_refer_friend_discount/reward`,
   `student_refer_family_discount/reward`, `referral_discount_amount`) +
   `referrals.referral_type` + `created_by` audit columns on
   `agent_commission_overrides` / `agent_self_referral_overrides`, all with
   ₪0 defaults.
2. `20260816010000_commission_engine_canonical.sql` — consolidated single
   canonical `record_case_commission` (additive + student_referral branch +
   partner_base_pool hardening) and `get_effective_agent_split` (additive).
   The 16 prior duplicate definitions of `record_case_commission` and 2 of
   `get_effective_agent_split` are superseded by `CREATE OR REPLACE`.
3. `20260816020000_commission_hub_rpcs.sql` — `admin_set_commission`
   centralized write RPC (single chokepoint, writes `commission_rate_history`)
   + Hub read RPCs (`get_commission_hub_overview`,
   `get_agent_network_detail`, `get_independent_accounts`,
   `get_account_commission_history`, `get_student_referral_config`,
   `get_student_referral_reward`).

### Frontend

- `src/pages/admin/AdminCommissionHubPage.tsx` — the Hub (Overview / Global
  rates / Team / Agents / Independent / Students tabs), wired via
  `src/hooks/useCommissionHub.ts`.
- `src/components/admin/CommissionSettingsPanel.tsx` is superseded: the
  AdminSettingsPage commission tab now redirects to the Hub.
- `src/components/dashboard/ReferralForm.tsx` — friend/family selector
  captures `referral_type`, persisted via the `create-case-from-apply` edge
  function.
- `src/services/DashboardService.ts` + `src/components/spreadsheet/sheetQueries.ts`
  — classifiers updated to recognize `student_referral` / `agent_override` /
  `master_partner` reward types separately from the partner pool.

### Diagnostics

- `supabase/diagnostics/commission_system_audit.sql` — read-only audit (9
  checks): conflicting function defs, paid cases missing rewards, leak
  rewards, orphan agent overrides, partners at ₪0, student rewards to
  non-students, legacy referrals missing `referral_type`, the additive
  invariant, and recent `commission_rate_history` rows.

### Migration filename hygiene (recommendation, not applied)

Five pre-existing migration pairs share timestamps
(`20260813120000`, `20260813130000`, `20260813140000`, `20260814150000`,
`20260814160000`) on `origin/main`. These were **not renamed** because they
are already deployed — renaming would make Supabase treat the renamed file as
a new migration and re-run it. New migrations use unique timestamps.

### Build/test status

`npm run build` clean; `npx vitest run` 355/355 pass.

## Commission system hardening — 7 genuine audit gaps (2026-08-17)

Forensic-audit-driven hardening of the commission/money-path. Scoped to ONLY
the genuine gaps; the audit findings that were already fixed or not actually
bugs were explicitly skipped (re-implementing them would have introduced
regressions, e.g. a universal ₪500 discount or re-adding a dropped RLS policy).
Plan: `.agents_tmp/PLAN.md`.

### Migrations (unique `20260817*` timestamps; require Supabase admin/service-role DDL — NOT applied by Vercel build or `ci.yml`; run via `supabase db push` or the dashboard SQL editor)

- `20260817000000_master_partner_agent_invariant.sql` (G1): the
  `restrict_profiles_write()` trusted-caller early-return path now enforces
  `is_master_partner = true AND agent_id IS NOT NULL → RAISE`. An
  agent-recruited partner (sits BELOW an agent) can NEVER become a Master
  Partner (top of an agent network) by any path — admin UI, RPC, or direct
  UPDATE. This is an integrity invariant (graph-cycle guard), NOT a permission
  rule, so it fires for admin/service_role too (the early-return path that
  previously skipped ALL validation). Non-admin callers already can't set
  `is_master_partner`, but the check is defense-in-depth. Diagnostic SELECT
  (commented) finds existing violating rows for operator review (NOT auto-deleted).
- `20260817010000_commission_margin_warning.sql` (G2 + G6 + G7):
  - **G2**: `record_case_commission` logs a NON-BLOCKING
    `commission_margin_warning` case event when `total_payouts > net` (negative
    Darb margin). Enrollment is NOT blocked; the existing
    `platform_revenue_ils = GREATEST(0, ...)` clamp stays (column never goes
    negative). `v_total_payouts` is recomputed per branch (agent self-ref uses
    `agent_self_amount`; student referrer uses `student_reward`; partner uses
    `pool + agent_share`). A previously-silent negative margin is now visible
    in the case event log.
  - **G6**: the deterministic attribution priority (partner_id > referred_by,
    then role lookup partner/ambassador > agent > student, first match wins,
    student referrals isolated) is documented in a header comment. No logic change.
  - **G7**: `auto_split_payment()` redefined to call
    `record_case_commission(NEW.id, 0)` directly, dropping the stale
    `case_submissions.service_fee` read (the canonical engine ignores the
    payment arg and derives the base from `case_services`, so the read was
    harmless but confusing). `trg_auto_split_payment` defensively DROP+CREATE'd
    to guarantee continuity regardless of which historical migration ran last.
- `20260817020000_attribution_lock_after_commission.sql` (G4): new
  SECURITY DEFINER `guard_case_attribution_lock()` + `BEFORE UPDATE` trigger
  `trg_guard_case_attribution_lock` on `cases`. Once
  `commission_split_done = true`, non-admin changes to `partner_id`/`referred_by`
  → `RAISE EXCEPTION 'ATTRIBUTION_LOCKED...'`. Admin overrides SUCCEED but are
  logged as an `attribution_override_after_commission` case event (auditable).
  ADDITIVE to `restrict_cases_financial_columns` (which gates WHO can change
  attribution: admin-only at any time). This gates WHETHER it can change
  post-commission + audits admin overrides. The two are orthogonal; either
  raising aborts the UPDATE. Honors the `app.internal_commission_split` GUC.
- `20260817030000_case_financial_snapshots.sql` (G3): new
  `case_financial_snapshots` table — freezes gross/net/discount/rates/payouts
  at enrollment so future rate/discount changes can't rewrite history. One row
  per case (UNIQUE `case_id`, `ON DELETE RESTRICT`), written ONCE by the
  engine. RLS: admin SELECT only; `REVOKE ALL FROM anon, authenticated;
  GRANT SELECT`. No client INSERT/UPDATE/DELETE (only the SECURITY DEFINER
  engine writes, as owner, bypassing RLS).
- `20260817040000_snapshot_in_engine.sql` (G3 cont.): full `CREATE OR REPLACE`
  of `record_case_commission` (carrying G2/G6 from `20260817010000`) + the
  snapshot INSERT before the final `UPDATE cases SET commission_split_done`.
  `ON CONFLICT (case_id) DO NOTHING` so a re-run (idempotency) never overwrites
  a frozen snapshot. Adds `v_referrer_role` derivation. All money math is
  byte-for-byte identical to the prior version.

### Frontend

- **G5** (`DashboardService.ts` + `AdminFinancialsPage.tsx`): the
  `teamCommissionsTotal` that `DashboardService.financialOverview()` already
  computed (line 62, classified via `isTeam`) is now EXPOSED on the
  `FinancialOverview` interface + return object, and rendered as a new KPI card
  in the Admin Financials overview grid (₪ + HandCoins icon, violet). i18n key
  `admin.financials.kpiTeamCommissions` added to en + ar.
- **Phase 4 — Commission Hub Simulator**: pure-frontend "what-if" calculator.
  `src/lib/commissionSimulator.ts` (pure `simulateCommission()` mirroring the
  ADDITIVE engine: `net = max(0, gross−discount); margin = max(0, net − team −
  pool − agent − student)`) + `src/components/admin/CommissionSimulator.tsx`
  (a new "Simulator" tab in `AdminCommissionHubPage`). Inputs: acquisition
  type (partner/agent_self/student/direct), gross, discount, pool, master carve,
  agent override, team rate, student reward. Output: NET, per-component payouts,
  total payouts, Darb margin, PASS/FAIL (negative-margin) badge. NO Supabase
  calls — pure TS. 27 i18n keys under `commissionHub.sim*`/`tabSimulator`
  added to en + ar (parity-guarded).

### Generated types

`src/integrations/supabase/types.ts` gained `case_financial_snapshots`
(Row/Insert/Update: `case_id` PK + gross/discount/net totals, attribution
columns, rate-used columns, payout-amount columns, classification flags,
`recorded_at`). `Relationships: []` (the FK to `cases` is enforced in SQL but
not surfaced as a relationship in the generated types, matching the pattern of
other audit tables like `commission_rate_history`).

### Diagnostics

`supabase/diagnostics/commission_engine_invariants.sql` extended with:
- **TEST 5** (snapshot created + immutable): after enrollment, exactly one
  `case_financial_snapshots` row with correct gross/net/payouts; re-running the
  engine adds no second row (`ON CONFLICT DO NOTHING`).
- **TEST 6** (margin-safety warning): with a partner pool override (₪6000)
  exceeding the ₪5000 net, enrollment logs exactly one
  `commission_margin_warning` case event and `platform_revenue_ils = 0`
  (clamped, not negative).

### What success looks like

- An agent-recruited partner CANNOT be designated Master Partner by any path.
- A negative-margin enrollment produces a visible `commission_margin_warning`
  in the case event log (not a silent negative `platform_revenue_ils`).
- A historical enrolled case's financial snapshot is frozen — changing global
  rates/discounts does not alter its `case_financial_snapshots` row.
- Attribution cannot be silently changed after commission is recorded (admin
  override is logged as `attribution_override_after_commission`).
- The commission engine's business logic (audit scenarios 1–9) is UNCHANGED —
  this adds guardrails, not new commission math.

### Build/test status

`npm run build` clean; `npx vitest run` 366/366 pass (+11 from the new
`commissionSimulator.test.ts`; i18n parity guard green).

## Student payout direct-thread gate + commission function grants (2026-08-17)

Companion hardening to the student-payout flow (committed in `44720f30`).
Migrations require Supabase admin/service-role DDL — NOT applied by the Vercel
build or `ci.yml`; run via `supabase db push` or the dashboard SQL editor.

- `20260817070000_restrict_commission_function_grants.sql`:
  - Revokes the over-broad `EXECUTE` grants on the commission functions that
    the canonical engine (`20260816010000`) recreated with `service_role`
    execution. Now: `record_case_commission`, `partner_base_pool`,
    `get_student_referral_reward` are `service_role`-ONLY (they are SECURITY
    DEFINER with no caller gate, so any authenticated caller could have run
    them with owner privileges).
  - `get_effective_agent_split` stays `authenticated`-callable BUT now gates
    callers: admin OR agent-self OR the `app.internal_commission_split` GUC
    set to `'on'` (the same escape hatch `record_case_commission` uses, set by
    the engine around its internal call). Direct client calls with arbitrary
    agent ids are rejected. The function body itself is unchanged.
- `20260817080000_student_direct_thread_gate.sql`: `send_direct_message` now
  rejects a `student` caller unless the target thread is linked to one of
  their own `payout_requests` rows. This closes the hole where a student could
  open a DM thread with ANY staff member and chat freely — a student's direct
  messaging is now limited to the payout conversation the payout flow created.
  The payout flow inserts the `payout_requests` row BEFORE posting the card, so
  the card message still posts. Only the gate was added; the rest of the
  function body is byte-for-byte identical to HEAD.
- Frontend: `StudentMessagesPage` gained a **Case/Payout tab switcher** (the
  student's payout direct thread now appears as a second conversation when a
  `payout_requests.thread_id` exists; a referring student with a payout but no
  own case still sees the payout conversation). `PayoutRequestCard` labels the
  requestor role-aware: student requestors show `chat.payout.student`
  ("Student") instead of "Partner". New i18n keys `messagesInbox.caseTab` /
  `messagesInbox.payoutTab` / `chat.payout.student` in en + ar (parity-guarded).
- Build/test: `npm run build` clean; `npx vitest run` green (i18n parity guard
  included).

## Important-contacts RPC authorization + case-insensitive city (2026-08-18)

Migrations require Supabase admin/service-role DDL — NOT applied by the Vercel
build or `ci.yml`; run via `supabase db push` or the dashboard SQL editor.

- `20260818000000_fix_contacts_case_insensitive_city.sql`: `get_school_important_contacts`
  now lowercases BOTH sides of the city comparison (`lower(COALESCE(ic.city,''))`
  vs `lower(COALESCE(NULLIF(p_city,''), sch.city, ''))`). `Heidelberg` vs
  `heidelberg` no longer silently fails to match; the student resolver delegates
  here, so the student Contacts page and the onboarding preview inherit the fix.
  Grants are re-asserted (REVOKE from PUBLIC/anon, GRANT to authenticated).
  Frontend: `AdminSettingsPage` city filter resolves `school_only` contacts'
  city from `schools` via `language_school_id` (their own `city` column is
  nulled by the form CHECK), and `distinctCities` dedupes/sorts case-insensitively.
- `20260818010000_gate_important_contacts_rpc.sql`: **`get_school_important_contacts`
  is now scoped to the caller's OWN school.** It is SECURITY DEFINER + granted
  to `authenticated`, so previously ANY logged-in user could call it with an
  arbitrary school UUID (school UUIDs are enumerable from `schools`) and read
  that school's contact names/phones/emails. The gate: admin → any school;
  `p_school_id IS NULL` → universal contacts only (unchanged for students with
  no school); otherwise the school must be the caller's `profiles.language_school_id`
  OR a school on one of their non-deleted `case_submissions` (the SAME two
  sources `get_student_important_contacts()` resolves). Unauthorized calls
  return ZERO rows (no error). Case-insensitive matching carried forward.
- Frontend (wizard preview): because the RPC is now gated, `StudentOnboardingGate`
  persists `profiles.language_school_id` immediately on school selection BEFORE
  fetching the preview (the wizard otherwise only persists a step on Next), so
  the live preview still works for a newly-picked school. `university_name` sync
  still happens on Next as before.
- Build/test: `npm run build` clean; `npx vitest run` green (i18n parity guard
  included).


## Team Catalog / TV Presentation page (2026-08-16)

- **Read-only presentation layer over the existing Admin Catalog.** The Admin
  Catalog (AdminProgramsPage -> `schools` / `accommodations` / `programs` tables)
  remains the single source of truth. The Team page only *consumes* catalog data;
  it never writes it (RLS gives `team_member` SELECT-only on all three tables;
  no INSERT/UPDATE/DELETE policies exist for team, so it is read-only by
  construction, not just by UI convention).
- Route: `/team/catalog` (`TeamCatalogPage`), lazy-loaded, behind the existing
  `ProtectedRoute allowedRoles={["team_member"]}` + `DashboardLayout
  role="team_member"`. Sidebar entry `nav.catalog` (Hotel icon, `nav.group.work`);
  mobile "More" sheet (`MobileBottomNav` `MOBILE_MORE_CONFIG.team_member`).
- **Data**: `useTeamCatalog` does ONE `Promise.all` fetch on mount
  (`schools` + `accommodations`, both `.eq('is_active', true)`, ordered by
  `name_en`). No per-keystroke refetch; search/filter are client-side over the
  fetched set. Matches the TeamWorkPage fetch-returns-cleanup pattern; `cancelled`
  flag prevents state updates after unmount.
- **Pricing is WEEKLY** (the catalog `price` column is the weekly rate; tiers in
  `price_tiers` are weekly discounts by `from_weeks`/`to_weeks`). The Team page
  reuses the authoritative `src/lib/programPricing.ts` helpers
  (`resolveWeeklyRate`, `parseWeekTiers`) -- the SAME lib the case forms use -- so
  prices always reconcile. Displays the correct weekly unit (the admin card's
  `/mo` label is misleading; admin left unchanged -- out of scope).
- **Images**: `photos text[]` entries are either Vite public paths
  (`/lovable-uploads/...`, bundled into the build) or full Supabase storage URLs
  (`school-assets` public bucket). Both render directly as `<img src>`. The Team
  page reuses the existing `ImageWithSkeleton` for load states. No new bucket.
- **Components** (`src/components/team/catalog/`): `TeamCatalogPage`
  (orchestrator), `CatalogFilters` (debounced search + city/school/room-type
  selects), `SchoolCatalogSection` (school-first grouping -- each school only
  shows ITS accommodations via the `school_id` FK, never a flat list),
  `AccommodationCard` (large image + prominent price overlay), `AccommodationDetail`
  (Dialog gallery with prev/next/thumbnails + all fields), `PresentationMode`.
- **Presentation/TV mode**: a `createPortal(..., document.body)` fixed overlay
  (not a Dialog -- avoids scroll constraints), Netflix-style showcase. Slideshow
  cycles school -> its accommodations -> next school. Single `setInterval`
  (re-armed only on playing/duration/count change; cleared on unmount/exit/pause --
  never multiple timers). Keyboard: ArrowLeft/Right = prev/next, Space = play/pause,
  Escape = exit (no text inputs in presentation mode to protect). Next slide's image
  preloaded via `new Image()`. Body scroll locked while open. Configurable slide
  duration (5/10/15s). TV-safe typography (text-4xl to 7xl), works at 1080p/4K.
- **Empty/error states**: uses the shared `@/components/shell` `LoadingState`/
  `EmptyState`/`ErrorState`. Handles no-schools, no-matches, no-photos, and
  load-error with retry. Presentation mode has its own empty state.
- **i18n**: `nav.catalog` + a `catalog.*` section added to en + ar `dashboard.json`
  (parity-guarded by `src/lib/i18nKeys.test.ts`). Inline English fallbacks via
  `t("key", "fallback")`. RTL-aware (logical properties, `rtl:rotate-180`).
- **No DB/RLS/storage changes.** No new tables, no migrations, no RLS weakening.
  The Team page is purely additive frontend over existing read-accessible data.
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 396/396 pass
  (+26 `catalogDisplay.test.ts` cases incl. the from-price invariant,
  `filterCatalog` pipeline, `priceTierOptions` labels, Western-numeral guard;
  `PresentationMode.test.tsx` removed with the component). ESLint 0 errors on
  all new files.
- **Redesign (per user feedback):** the TV slideshow/presentation mode was
  REMOVED entirely (PresentationMode.tsx + test deleted, button + state gone
  from TeamCatalogPage). Clicking a card's photo now opens a detail popup
  (AccommodationDetail) with the photo gallery on top (prev/next + dots to
  slide through that house's photos) and the info below. Price tier buttons
  ("1-4 weeks: €245", "5+ weeks: €210") let the team pick a duration; the
  displayed weekly price updates to the selected tier. All money numerals are
  forced Western (0-9) via `en-US` locale in `formatWeeklyPrice`/`formatMoney`
  — no Arabic-Indic digits regardless of UI language. The popup renders all
  admin-catalog fields: name, school, room type, meals, deposit, placement
  fee, distance note, school website, description, and the full tier ladder.

## CaseOverviewPanel "Referred By" — show whoever directly sent the student (2026-08-16)
- `src/components/cases/CaseOverviewPanel.tsx` shows ONE name in "Referred By":
  `referrerName ?? partnerName` — student referrer takes priority, otherwise the
  partner_id holder (agent self-referral via form/link, partner/ambassador link,
  or a partner/ambassador recruited by an agent). No `source_attribution_method`
  branching — the fallback is unconditional (one line). The old separate
  "Partner" row was REMOVED entirely (it was internal attribution data, not a
  useful overview field). The orphaned `case.overview.partner` i18n key stays in
  en/ar (the parity guard only flags missing keys, not orphans).
- Attribution, commissions, and network KPIs are untouched — they resolve
  server-side (`record_case_commission`, `get_my_agent_network`,
  `get_my_agent_students`, `get_partner_pool_cases`) and render in their own
  dashboards, never re-derived in this panel.
- Name resolution still goes through the SECURITY DEFINER `resolve_profile_names`
  RPC (team RLS on `profiles` would silently miss partner_id/referred_by rows on
  a direct `.in()`).
- Tests: `src/components/cases/__tests__/CaseOverviewPanel.test.tsx` (5 cases)
  cover the three attribution paths: partner self-referral (form + link),
  agent's recruited partner, student-to-student, plus no-attribution.
- Build: `npm run build` clean; `npx vitest run` 401/401 pass (45 files).

## Commission simplification — flat additive architecture (2026-08-17)

Removed the **Master Partner** concept from the active app + commission engine,
wired the **Ambassador** rate correctly (was silently reusing the Partner rate),
and removed the obsolete generic `referral_discount_amount` from the active UI.
The project is preproduction; the SQL migration is prepared for **manual**
execution (NOT applied by the Vercel build or `ci.yml` — run via
`supabase db push` or the dashboard SQL editor).

### SQL migration (manual)
- `supabase/migrations/20260818000000_commission_simplification.sql`:
  1. `partner_base_pool(p_partner_id)` is now **role-aware**: ambassadors
     resolve `platform_settings.ambassador_commission_rate`, partners resolve
     `partner_commission_rate`. This is the ambassador-wiring fix (the old body
     read ONLY `partner_commission_rate` regardless of role). Per-partner /
     per-ambassador overrides still win via the existing override tables.
  2. `record_case_commission` rebuilt as the **simplified flat engine**: NO
     master branch, NO `get_effective_partner_split` call. The referrer keeps
     the FULL pool (no master carve). PRESERVES the `case_financial_snapshots`
     INSERT (from `20260817040000`) and the `log_case_event` audit call (from
     `20260817010000`) — these audit/determinism guardrails must not regress.
     Agent self-referral + student-referral branches unchanged (additive,
     margin-funded). `pg_advisory_xact_lock` + `commission_split_done` +
     `ON CONFLICT` + 20-day `unlock_at` all preserved.
  3. `get_commission_hub_overview` drops `master_partners` and
     `master_share` from the response; KEEPS `partners_at_zero` (unrelated).
  4. `admin_set_commission` rejects the now-obsolete rate kinds
     (`master_partner_override_rate`, `referral_discount_amount`).
  5. NEW `get_student_referral_discount_by_type(p_referral_type text)` —
     student-readable RPC returning the friend/family discount (replaces the
     generic `get_referral_discount_amount`). Granted to `authenticated` only.
  6. OPTIONAL CLEANUP section drops `platform_settings.master_partner_override_rate`
     + `referral_discount_amount` columns, the `get_referral_discount_amount()`
     function, `profiles.is_master_partner` + `profiles.master_partner_id`
     columns, `partner_recruit_applications.master_partner_id` + FK, and the
     `rate_offers` table + the three rate-offer RPCs
     (`master_send_rate_offer`, `partner_respond_rate_offer`, `get_my_rate_offers`).
- The `get_effective_partner_split` function is NO LONGER CALLED by the engine;
  its generated `types.ts` entry is left in place (harmless — mirrors retained
  DB columns; removing is non-durable).

### Frontend — Master Partner fully removed from active UI
- DELETED: `src/hooks/useIsMasterPartner.ts`, `src/components/admin/MasterPartnerToggle.tsx`
  (+ test), `src/pages/partner/PartnerPerformancePage.tsx`,
  `src/pages/partner/PartnerNetworkPage.tsx`, `src/pages/partner/PartnerNetworkHubPage.tsx`,
  `src/components/partner/RateOfferInbox.tsx`, `src/components/partner/RateOfferDialog.tsx`.
  The `/partner/network` route removed from `App.tsx`; the Crown nav injection +
  `useIsMasterPartner` import removed from `DashboardLayout.tsx`; `/partner/network`
  removed from `MOBILE_MORE_CONFIG` in `MobileBottomNav.tsx`. `<RateOfferInbox />`
  import + usage removed from `PartnerOverviewPage.tsx`.
- `AdminCommissionHubPage.tsx`: removed `master_partner_override_rate` +
  `referral_discount_amount` from `globalRates`, the Master KPI card (Crown),
  the Crown lucide import. Renamed "Partner pool"→"Partner", "Agent (additive)"→"Agent recruitment".
  `independentHint` + `kpiIndependentSub` fallbacks updated to drop "no master partner".
- `useCommissionHub.ts`: removed `master_partners` from `CommissionHubOverview`,
  `master_share` + `referral_discount` from `global_rates`, `master_partner_id`
  + `is_master_partner` from `AccountCommissionHistory.account`.
- `commissionSimulator.ts` + `CommissionSimulator.tsx`: removed `masterShare`
  from input/result interfaces, the "Master carve" field, and the masterShare
  result rows. `partnerShare = partnerPool` (full pool, no carve). The pure
  simulator now mirrors the simplified engine.
- `PartnerEarningsPage.tsx`: removed the `overrideRewards` state, the
  `.eq("reward_type", "master_override")` query, and the "Network override
  earnings" Card.
- `PartnerProfilePage.tsx`: removed `is_master_partner` from the select +
  interface, the master Crown badge, the `Badge` + `Crown` imports.
- `RecruitApplicationsPanel.tsx`: removed `master_partner_id` from `AppRow`,
  the `master:profiles!...` join from the select, the `r.master?.full_name`
  fallback. The DB column stays (not dropped by the REQUIRED SQL — only the
  OPTIONAL cleanup touches it).
- `MemberList.tsx` / `AdminMembersPage.tsx` / `MemberDetailDrawer.tsx` /
  `RoleDirectory.tsx` / `RequesterProfilePanel.tsx`: master fields, toggle,
  Crown badge, master filter, network-membership UI all removed (MemberDetailDrawer
  keeps its `Crown` lucide import — still used for the agent `kpiOverrideEarned` KPI).
- `ReferralForm.tsx`: replaced the `get_referral_discount_amount` RPC with
  `get_student_referral_discount_by_type({ p_referral_type })`, re-running on
  `referralType` change so a friend vs family referral can carry different
  discounts. Default 0 (was hardcoded 500).
- Cosmetic: `JoinPartnerPage`, `AgentInviteToggle`, `AgentCreateAccountsToggle`
  JSDoc comments de-"master partner"-ed.

### Historical reward classification (backward compat — DO NOT re-remove)
- `commissionClassifier.ts` KEEPS `master_partner`, `master_override`,
  `network_split`, `agent_override` in `PARTNER_POOL_REWARD_TYPES` so
  already-paid historical rewards still bucket into the partner pool for
  dashboard financials. They are mapped to `"other"` in `classifyReward`
  (legacy display only — the engine no longer creates them). `DashboardService`
  + `sheetQueries` classifiers are unchanged (they already use the set).
- `RewardKind` gained `"ambassador"` + `"agent_recruitment"`; `"master_override"`
  was removed from the union (legacy types map to `"other"`).

### i18n
- Orphaned locale keys (`commissionHub.rateMaster`, `rateReferralDiscount`,
  `kpiMasters`, `simMaster`, `simMasterOut`, `partner.profile.masterBadge`)
  are LEFT in en/ar — the `i18nKeys.test.ts` parity guard only flags MISSING
  keys, not orphans, so leaving them is non-breaking and avoids churn. No
  `t()` call references them anymore.
- `sheets.value.kind.ambassador` + `.agent_self_referral` added to en + ar
  (the spreadsheet value-kind column).

### Build/test
- `npm run build` (tsc+vite) clean; `npx vitest run` 395/395 pass (44 files),
  incl. i18n parity guard. `commissionSimulator.test.ts` lost the two master-carve
  cases (replaced by a "partner keeps full pool" case, net −1).


## Code-review patterns (skill)

Recurring review findings are distilled into a skill at
`.agents/skills/trust-boundary-guards/SKILL.md`. Read it before opening a PR
with a state-changing feature. The three patterns that keep surfacing:

- **Guard irreversible actions at the service/RPC layer, not just the UI.**
  The UI hides the button for UX; the service function must be idempotent
  (no-op on retry) because it is the trust boundary every caller passes
  through. Mirror the `commission_split_done` + `pg_advisory_xact_lock`
  pattern in TS service functions.
- **Detect "new item arrived" via identity (id), not array length.** Stores
  that cap and replace in place (shadcn `useToast`, `TOAST_LIMIT=1`) make a
  length check silently miss rapid successive items. Track the newest id.
- **Reuse expensive browser resources; reset UI state after terminal actions.**
  Hoist `AudioContext`/workers/etc. to a lazy singleton (browsers cap
  concurrent instances). Clear in-flight flags + close dialogs on success so
  the user isn't locked into a "processing" state.

The skill includes a pre-review checklist and before/after code snippets.


## Returned-by-Admin flow — chat echo of the return/resubmit (2026-08-18)
- The "Return for changes" (admin -> team) and "Resubmit to admin" (team -> admin) loop was already wired (commits 325d4e1/0dd80ae). This adds the **chat echo**: the same note is auto-posted to the case chat thread so it surfaces in the conversation the team/admin already watch, not only in the amber banner + Work-page card.
- **RLS gotcha (do NOT raw-insert)**: `case_messages` has NO INSERT policy for `authenticated` — only `service_role` has INSERT. The conversation thread's suggested `supabase.from('case_messages').insert(...)` snippet would be rejected by RLS. The ONLY client path is the SECURITY DEFINER RPC `send_case_message` (wrapped by `sendCaseMessage` in `src/services/CaseMessageService.ts`), which stamps the real author/role server-side, marks the thread read, fires notifications, and logs a `message_sent` case event.
- Both echoes use **`visibility: "internal"`** (staff-only) — the return note and the resubmit notice are internal workflow, not student-facing.
- **Best-effort, non-blocking**: the chat post runs AFTER the state RPC (`request_case_changes` / `resubmit_case_for_review`) already succeeded and is wrapped in its own try/catch. A chat hiccup must NOT roll back an already-completed return/resubmit — the banner + Work page still show the note from `case_submissions.review_note`. The state transition is the source of truth; the chat echo is the audit trail.
- i18n keys (en + ar, parity-guarded): `admin.submissions.returnChatPrefix` and `case.submit.resubmitChatNote`.
- Build clean; `npx vitest run` 414/414 pass (i18n parity guard green).

## v_cash_debts KPI regression — RPC-first fix (2026-08-21)
- `v_cash_debts` (and the `settle_cash_collection` RPC) were created on the live DB out-of-band. Migration `20260818012648` captured the security hardening in VCS: `ALTER VIEW ... SET (security_invoker = true)` (view now runs as the viewer, enforces RLS on cases/case_payments/rewards — was a real leak) + `REVOKE ALL FROM anon, authenticated` + `GRANT SELECT TO service_role`. Generated `types.ts` gained the `v_cash_debts` Row + `settle_cash_collection` signature.
- The revocation broke the "Cash Collection Debt" KPI: both frontend readers (`src/components/admin/MemberDetailDrawer.tsx`, `src/pages/team/TeamAnalyticsPage.tsx`) did a direct `.from('v_cash_debts').select()` as the authenticated user → silently empty (swallowed by try/catch).
- Fix (migration `20260821120000_cash_debts_rpc.sql`): keep the view revoked from authenticated (security posture preserved) and expose two SECURITY DEFINER RPCs that scope server-side — `get_my_cash_debts()` (team member, `WHERE team_member_id = auth.uid()`) and `get_member_cash_debts(p_member_id)` (admin only via `has_role('admin')`, any member). The functions run as owner (bypass the view's security_invoker + table RLS), but the WHERE clause / role check IS the trust boundary. Matches the repo's RPC-first pattern (`get_partner_pool_cases`, `get_my_agent_network`, `get_student_important_contacts`).
- Frontend: `TeamAnalyticsPage` → `supabase.rpc("get_my_cash_debts")` (no `.eq` — scoped server-side); `MemberDetailDrawer` → `supabase.rpc("get_member_cash_debts", { p_member_id })` then filter `debt_status === "pending"` client-side (matches the previous `.eq("debt_status","pending")`). `types.ts` gained both RPC signatures. The debt row type is derived from the RPC return (`Database["public"]["Functions"]["get_member_cash_debts"]["Returns"][number]`) in BOTH readers — single source of truth, no hand-written interface to drift (the old `CashDebt` interface declared non-null fields while the RPC returns nullable ones; `tsconfig.app.json` `strict:false` had masked the mismatch). Render call sites null-guard the nullable `payment_id` (React key falls back to `idx-${i}`), `case_id` (Settle button disabled + guarded), and `student_name`/`amount_owed_to_admin` (fallbacks). The `settle_cash_collection` call is now typed too (its signature already existed in `types.ts`). Both fetch catches `console.warn` the error (was a silent swallow). No `(supabase as any)` casts remain on the cash-debt path.
- The earlier `20260821000000_restore_cash_debts_view_grant.sql` (Option A: re-grant the view to authenticated) was REMOVED — it contradicted the "direct view access stays revoked" posture. It was never applied to the live DB, so removing it is non-breaking.
- The `settle_cash_collection` RPC is unaffected (RPC, not a view read) — only the read broke.
- DDL is NOT applied by the Vercel build or `ci.yml`; apply via `supabase db push` or the dashboard SQL editor (admin/service-role only). Until `20260821120000` is applied, the KPI stays empty.

## DARB Document Center — frontend removed, DB retained (2026-08-18)

The Documents Center admin frontend (library page `/admin/documents`, block
editor `/admin/documents/:id/edit`, `DocBlock` model, jsPDF generator, seed
content, nav entries, `admin.documents.*` + `nav.docCenter` i18n keys) was
REMOVED. Do not reference those files — they no longer exist.

What REMAINS (intentional, out of removal scope):
- DB tables `documents_library` + `document_versions` (migrations
  `20260818143621` / `20260818143644`), the private `darb-documents` storage
  bucket, and the `seed_starter_documents` RPC (`20260822000000`), plus the
  seed migrations `20260824000000` / `20260825000000`.
- Generated `src/integrations/supabase/types.ts` keeps the matching table/RPC
  entries (mirrors the live schema — do not hand-edit).
- No migration/RLS/storage changes were made; all Document Center DDL stays
  manual (apply via `supabase db push` or the dashboard SQL editor).

## Invitation reconciliation generalized to staff roles (2026-08-18)
- **Bug**: `accept-invitation` had a non-atomic sequence — role upsert → concurrent-role
  check → profile upsert (fatal) → case link → close invitation. Any throw after the
  role upsert left `user_invitations.status='pending'` while the account was already
  live (`handle_new_user` auto-creates the base `profiles` row, so
  `get_members_directory` showed the partner while Pending Invitations still listed
  the invite; every retry re-failed).
- **Edge fix** (`supabase/functions/accept-invitation/index.ts`): the invitation is
  now closed (pending→accepted, `accepted_user_id`) IMMEDIATELY AFTER the
  concurrent-role check, BEFORE the profile upsert/case link — identity+role is the
  commit point, peripherals can't block. The `profiles` upsert is wrapped in try/catch
  logging `accept_invitation_profile_patch_failed` (warning) and execution continues —
  the warn carries the full intended patch payload (email masked) because the closed
  invitation means no client retry path, so the log line is the operator's recovery
  handle. A `logStep(step, meta)` helper labels each phase
  (`adopt_or_create`, `role_upsert`, `concurrent_role_check`, `close_invitation`,
  `profile_patch`, `case_link`, `recruit_application`, `audit_log`) — never logs token
  or password, and masks emails (same regex as `get_invitation_preview`). After the
  close succeeds it calls the generic
  `reconcilePendingInvitations` helper to close sibling pending rows of the same type.
- **Migration `20260826000000_reconcile_staff_invitations.sql`** (MANUAL APPLY —
  not applied by Vercel build or CI; run via `supabase db push` or the dashboard SQL
  editor. Until then stuck invitations stay stuck; the frontend filter mitigates the
  display only):
  1. `reconcile_staff_invitations()` SECURITY DEFINER trigger `AFTER INSERT ON
     user_roles` maps role→invitation_type (social_media_partner→'partner',
     ambassador→'ambassador', agent→'agent', team_member→'team') and closes pending
     invites of that type for the profile email. Student stays owned by
     `trg_reconcile_student_invitations` (untouched). Idempotent, no recursion
     (updates a different table), no RLS change.
  2. One-time idempotent cleanup UPDATE joins `profiles` × `user_roles` with the
     CASE-mapped role, `deleted_at IS NULL`, pending→accepted only (never DELETE).
     This automatically closes the currently-stuck partner invitation.
  3. `get_invitation_preview` `recruiter_name` now resolves
     `COALESCE(master_partner_id, agent_id, inviter_id)` — current code never sets
     `master_partner_id`, so agent-invited recruits previously saw no recruiter name
     on /activate. Grants re-asserted (anon, authenticated, service_role).
- **Frontend defense-in-depth**: `AdminMembersPage` derives `activeMemberEmails`
  (all four member queries minus `is_deactivated`, normalized+deduped) and passes
  it to `PendingInvitations` as `activeEmails`; the component filters with the
  (already type-generic) `filterActiveInvitations` from `src/lib/studentInvitations.ts`
  via `useMemo`. Hides invites whose email belongs to an active member even before
  the migration runs.
- **Diagnostics**: `supabase/diagnostics/invitation_reconciliation_audit.sql` — read-only
  SELECT listing pending invites of ALL types whose email matches an active profile
  with the mapped role; commented aggregate + deactivated-account variants.
- Tests: `src/components/admin/__tests__/PendingInvitations.test.tsx` (5 cases —
  hide matched, case-insensitive, show unmatched, mixed list, deactivated-member
  emails not passed). Build clean; `npx vitest run` 438/438 pass.



## Unified partner/ambassador features — per-profile admin toggles (2026-08-19)
- `social_media_partner` and `ambassador` are now functionally identical: BOTH
  get the referral link AND the built-in apply form, each independently gated
  by an admin-only per-profile toggle. The role enum is unchanged.
- **Flags**: `profiles.referral_code_enabled` (existing) +
  `profiles.apply_form_enabled` (new, `NOT NULL DEFAULT true` — every existing
  and future profile starts enabled). Migration
  `20260827000000_apply_form_enabled_flag.sql` adds the column and recreates
  `restrict_profiles_write()` (verbatim from the live 20260818000000 def) with
  the new guard: INSERT forces `apply_form_enabled := false` for non-admin
  self-inserts; UPDATE rejects non-admin changes. **Timestamp must stay newer
  than 20260818000000** — re-running the older file would drop the guard.
  Generated `types.ts` gained the column (Row/Insert/Update).
- **Gating surfaces** (all read the flag live from `profiles`):
  - `src/hooks/useApplyFormEnabled.ts(active)` — shared hook, defaults `true`
    while loading (page guard is the real gate; cosmetic flash only), `active`
    skips the profiles read for non-partner roles.
  - `DashboardLayout.tsx` — `PARTNER_APPLY_NAV_ITEM` shared by both roles;
    `SidebarNav` filters `nav.apply` out when the flag is false.
  - `MobileBottomNav.tsx` — ambassador's "More" sheet gained the Apply entry;
    same filter.
  - `PartnerApplyPage.tsx` — guard is now flag-based (both roles allowed;
    `apply_form_enabled === false` redirects to `/partner`). Role-only guard
    removed.
  - Referral link needs no new gating — `ReferralLinkCard` already self-hides
    when `referral_code_enabled === false` and the shared
    `PartnerOverviewPage` renders it for both roles.
- **Admin toggles**: `ProfileFeatureToggle.tsx` (generic switch + confirm
  dialog + persisted-value report, mirrors `AgentInviteToggle`) with thin
  wrappers `ReferralLinkToggle.tsx` / `ApplyFormToggle.tsx` (literal i18n keys
  `admin.features.*`). `RequesterProfilePanel.tsx` renders both for
  `isPartner || isAmbassador` (`hasMemberFeatures`), fetching the two flags by
  `requester_id` (the directory RPC does not return them). The
  `AgentParentToggle` (agent recruiter link) is now shown for ambassadors too
  — `enforce_agent_graph` permits partner/ambassador recruits.
- i18n: `admin.features.*` (18 keys) in en + ar (parity-guarded). MANUAL DEPLOY:
  migration via `supabase db push` / dashboard SQL editor.


## Commission Hub rebuild — single production resolution path (2026-08-19)
- Migration `20260828000000_commission_hub_rebuild.sql`: every Hub surface +
  the simulator reads effective rates server-side from the SAME resolver
  functions the commission engine calls (override-if-exists-else-global;
  dynamic-at-enrollment semantics preserved). MANUAL DEPLOY required.
  - `get_commission_hub_overview` + 4 recruited/direct counts (user_roles ×
    profiles, deleted_at IS NULL).
  - `get_agent_list` + self_referral_override/global + status (deactivated_at).
  - `get_team_members_commission` captured into VCS (was out-of-band on the
    live DB) + is_manager + global_rate.
  - NEW `get_partner_list` / `get_ambassador_list` (all accounts incl. recruited,
    agent_name JOIN; ambassadors resolve `ambassador_commission_rate` default).
  - NEW `get_commission_simulation_inputs(p_user_id)` — resolves effective
    rates by CALLING the production resolvers (`partner_base_pool`,
    `get_effective_agent_split` under the `app.internal_commission_split` GUC,
    `get_effective_agent_self_referral`, `get_student_referral_reward`). The
    simulator never re-implements rate resolution in TS.
- `useCommissionHub.ts`: +4 overview fields, +3 agent fields, +2 team fields,
  new `PartnerListItem` interface, `fetchSimulationInputs()` (lazy, not in
  fetchAll), partner/ambassador lists in fetchAll (7 RPCs).
- `AdminCommissionHubPage.tsx`: tabs Overview / Global rates (reordered +
  explainer) / Team Members (manager + default/custom badges) / Agents (status
  badge + 2 independent rate rows) / Partners / Ambassadors (shared
  `PartnerFamilySection` + `CommissionAccountRow`, recruited badges with agent
  name) / Students / Simulator. Old "Direct (no recruiter)" tab removed.
- `CommissionSimulator.tsx`: pure `simulateCommission` math UNCHANGED (verified
  vs engine); inputs resolved server-side via `get_commission_simulation_inputs`
  with a person picker + relationship-chain line + "Reset to configured".
- Ambassadors intentionally share `partner_commission_overrides`
  (entity_type='partner'); only the global default differs — preserved.
- i18n: `commissionHub.*` +30 keys (en+ar parity).
- Test updated: `AdminCommissionHubPage.test.tsx` asserts the recruited/direct
  KPI grid. `commissionSimulator.test.ts` untouched (pure math unchanged).
- NOTE: pre-existing `get_independent_accounts` still filters on
  `master_partner_id` and breaks IF the simplification's OPTIONAL CLEANUP was
  applied; the new Partners/Ambassadors tabs supersede it in the UI.

## Master-partner residual purge (2026-08-19)
- The simplification's OPTIONAL CLEANUP was never applied live; standalone
  migration `20260830000000_master_partner_cleanup.sql` runs those DROPs
  verbatim + IF EXISTS (profiles master columns, platform_settings obsolete
  rates, recruit-application column + index, partner_rate_offers table,
  master/rate-offer RPCs, get_effective_partner_split,
  get_referral_discount_amount, get_master_partner_override_rate). MANUAL
  DEPLOY. Existence checks embedded in the header comment.
- Verified NO live UI reference remained (only the intentional
  `commissionSettings.hubRedirect/openHub` note). Orphan i18n keys REMOVED
  from en+ar: commissionSettings.masterShare/allocationHint/masterShareTooHigh,
  commissionHub.rateMaster/kpiMasters/simMaster/simMasterOut, admin payouts
  masterBadge/filterMaster, partner.profile.masterBadge (parity guard passes;
  orphans are no longer "left intentionally").
- Kept BY DESIGN: commissionClassifier's historical master reward types
  (legacy paid-reward bucketing); case_financial_snapshots.master_* snapshot
  columns; user_invitations.master_partner_id (legacy rows);
  master_services/* (unrelated DARB catalog concept); and the simulator's
  "Partner pool" (the legitimate base commission — NOT the master pool).
- types.ts: single stale entry `get_master_partner_override_rate` removed;
  profiles/partner_recruit_applications blocks already had no master fields.

## Partner Schools knowledge base (2026-09-18)

Internal reference tool for partner language schools, read-only for team/admin.
Tables: `partner_countries`, `partner_schools`, `school_price_versions`,
`school_courses`, `school_course_price_tiers`, `school_level_durations`,
`school_accommodations`, `school_accommodation_price_tiers`,
`school_start_dates`, `school_policies`, `school_notes`, `school_sources`.

- Pages: `src/pages/team/TeamPartnerSchoolsPage.tsx` (country list) ->
  `TeamPartnerSchoolsCountryPage.tsx` -> `TeamPartnerSchoolPage.tsx` (8 tabs).
- Data access: `src/hooks/usePartnerSchools.ts` (never writes - admin editing
  screens are a separate, later phase).
- Pricing logic lives only in `src/lib/partnerSchools.ts` (testable, no JSX):
  course tuition puts the WHOLE booking in one weekly band chosen by total
  weeks; accommodation uses fixed totals for short stays then a weekly rate.
- `src/components/team/partnerSchools/SchoolCalculator.tsx` is the single
  calculator; every school plugs into it. No second calculator.

**Schools seeded (all 2026, `sort_order` = card order):**
1. `kapito` - KAPITO Sprachschule, Munster (migration
   `20260918102914_*.sql`)
2. `goacademy-dusseldorf` - GoAcademy! Dusseldorf (migration
   `20260918210000_add_goacademy_partner_school.sql`), linked to catalog
   school `go-academy`
3. `alpha-aktiv` - Alpha Aktiv Sprachschule, Heidelberg (migration
   `20260918200000_partner_school_alpha_aktiv_2026.sql`), linked to catalog
   school `alpha-aktiv`

There is NO F+U partner school. F+U Academy of Languages appears in the DARB
Catalog (`20260820000000_school_catalog_seed.sql`) and in
`.lovable/plan/partner-schools-add-f-u-academy-of-languages-...md`, but no
partner-school migration was ever written for it. Do not cite it as an
existing precedent.

All migrations here are MANUAL DEPLOY (`supabase db push` or the dashboard SQL
editor) - the Vercel build and CI do not apply them. Each is idempotent and
guarded by its unique `partner_schools.slug`.

### Catalog linking (single mechanism, do not fork)

- `school_accommodations.catalog_accommodation_ids uuid[]` points a housing
  option at the exact existing catalog `accommodations` row(s).
- `partnerSchoolCatalogUrl()` builds
  `/team/catalog?school=<catalogSchoolId>&tab=accommodations&ids=<id,id>`;
  `TeamCatalogPage` reads `ids` and, when exactly one id, opens its detail.
- **Never create duplicate catalog rows.** Match by `name_en`, link the id.
  A school-only option (host families) keeps the empty list and renders
  "Not in the DARB catalog - the school arranges this option directly."

### Two price sources must agree

The Partner School page and Team Catalog render the same rooms, so a brochure
price must land in both. When adding one, correct the catalog row too
(`price` = cheapest long-stay weekly band; `price_tiers` = the same bands) and
keep `from_price_per_week` equal to the 24+/long-stay rate. Never leave one
screen at a different price. The Alpha Aktiv migration fixes the
"Double Not Central" 27+ band (140 -> 130) and adds the published apartments
the catalog was missing.

### Bilingual + source rules

- Every field has EN + AR where the schema supports it. Reuse existing
  `partnerSchools.*` keys in `public/locales/{en,ar}/dashboard.json`; do not
  invent alternate Arabic terminology. `src/lib/i18nKeys.test.ts` is the
  parity guard - a key referenced from source must exist in BOTH locales.
- Each fact carries `source_name` / `source_document` / `source_year` /
  `last_verified_at`. Anything the source does not print stays empty and
  reads "Not recorded - verify with the school" - never invent a value.
  Do not write a `last_verified_at` you did not actually verify.
- `school_notes` kinds drive the page and have KAPITO-specific fallbacks:
  `accommodation` (else a KAPITO single-room paragraph shows),
  `registration_official` (else "Official KAPITO procedure"),
  `darb_recommendation`. A new school MUST seed its own notes or KAPITO text
  leaks onto its page.
- Course inclusions used in a seed must have an `INCLUDED_ITEM_AR` entry,
  otherwise Arabic silently falls back to English.

### Additive columns

Added progressively; each is NULL for schools seeded before it, so their
rendering and calculator output are unchanged.

- `school_accommodation_price_tiers.night_price` (Alpha Aktiv) - published
  "1 night" rate. Calculator: accommodation weeks = 0 quotes `night_price`
  via `quoteStay()`. Also shown in the accommodation tier row.
- `school_courses.registration_fee` (Alpha Aktiv) - per-course fee. Shown in
  the courses tab and added to the calculator's payable total and "Copy
  answer".
- `school_level_durations.weeks_max` (GoAcademy) - lets a level publish a
  duration range instead of one number.

## Partner Schools: GoAcademy! Dusseldorf 2026 (2026-09-18)

Second Partner School, seeded exactly like KAPITO (same tables, same
`TeamPartnerSchoolPage`; no school-specific UI, no calculator changes). Route
`/team/partner-schools/germany/goacademy-dusseldorf`, slug
`goacademy-dusseldorf`, linked to catalog school `go-academy` via
`catalog_school_id`. Depends on the additive columns
`school_accommodations.catalog_accommodation_ids` (`20260918193420`) and
`school_level_durations.weeks_max` (`20260918183959`), both timestamped
earlier.

- Seeded rows: 2026 EUR price version (is_current) -> 7 courses -> 5 level
  durations -> 7 accommodations -> 16 policies -> 3 notes -> 5 sources.
- Courses: `standard_intensive` (20 + 5 LMS, DARB standard, cefr A1-C1,
  tiers 1-4:190 / 5-24:175 / 25-52:165), `high_intensive` (30 + 5 LMS,
  tier 1-2:315), `university_pathway` (tier 24-48:175), `vocational_training`
  (tier 12-48:175), `evening_course` (4 lessons/wk, monthly pricing),
  `german_for_doctors` (EUR 920 total), `german_for_nursing` (EUR 790 total).
  Courses with only total/monthly prices get rows with NO tiers -> excluded
  from the DARB standard set (`is_darb_standard=false`) and from the
  calculator; their verified totals/dates/packages are recorded as policies
  (doctors/nursing start dates, University Pathway packages
  4,900/6,900/8,900, evening 185/175/160).
- Accommodations: `standard_shared/single`, `comfort_shared/single`,
  `studio`, `host_family_bb`, `host_family_half` - each linked to the matching
  catalog accommodation by `name_en` subselect, with `from_price_per_week` =
  the 24+ catalog rate (130/180/150/210/270/250/300). `arrangement_fee` 90,
  deposit 250, airport transfer 100/150 recorded as data (NOT added to
  calculator totals - same decision as KAPITO).
- Policies span categories registration/arrival/accommodation/course/program/
  exam/about/other (registration EUR 60, placement EUR 90, transfer EUR 100
  one-way / EUR 150 both ways, telc/TestDaF/TestAS/DSH exam fees, ISO/AZAV +
  IALC memberships).
- The 3 `school_notes` kinds are the SAME kinds `TeamPartnerSchoolPage.notesOf()`
  reads, so the KAPITO-specific fallback strings are suppressed for GoAcademy.
  `featured_weeks` NULL; `last_verified_at` NULL everywhere (no fake
  verification dates); `source_year` = 2026.
- `school_sources` holds the five supplied GoAcademy 2026 documents (German
  courses brochure, price list, accommodation doc, agency brochure, IH school
  presentation - exact filenames from `Downloads/`).
- `src/lib/partnerSchools.ts`: `INCLUDED_ITEM_AR` +6 entries so every
  `included_items` string used in the seed localizes to Arabic (no silent
  English fallback): certificate, LMS tuition, weekly counselling, university
  application support, visa assistance, TestDaF/telc/TestAS/DSH prep at the
  school centre.
- `src/lib/partnerSchools.test.ts`: GoAcademy describe block using the seeded
  shapes - A1->C1 = 44-50 weeks (published ranges, `weeks_max`), 44x165 =
  EUR 7,260 / 50x165 = EUR 8,250 in the 25-52 band, 4 wks EUR 760, 12 wks
  EUR 2,100, accommodation 4/10/26 wks = EUR 660/1,450/3,380, Arabic
  included-item localization.
- Live QA (list/detail/tabs/EN-AR, no duplicate catalog entry, calculators
  unchanged) must be done after the migration is applied.

## Partner Schools: Alpha Aktiv Sprachschule 2026 (2026-09-18)

Third Partner School, same architecture as KAPITO and GoAcademy. Route
`/team/partner-schools/germany/alpha-aktiv`, slug `alpha-aktiv`, linked to
catalog school `alpha-aktiv`.

- Seeded from the official 24-page Course Program 2026 brochure plus the
  official website where the brochure is silent. Seeded rows: 2026 EUR price
  version -> 11 courses -> 5 level durations (A1-C1) -> 14 accommodations ->
  12 start dates -> 5 policies -> 4 notes -> 2 sources.
- Courses: `intensive20` (DARB standard, 215/190/165/150 across four weekly
  bands), `superintensive25` (260/230/210/195), `superintensive30_conversation`
  (275), `intensive20_plus5` (415/390/365), `intensive20_plus10`
  (615/590/565), `private_normal`, `private_exam_prep`, `evening`,
  `prep_dsh_testdaf` (205), `prep_telc` (205), `school_preparation` (885).
  Registration fee EUR 50 on every course.
- **C2 is deliberately absent from `school_level_durations`** because the
  source publishes no duration for it. The calculator then renders "not
  recorded" instead of guessing - do not "fix" this by inventing a number.
- Accommodations: single/double student residence and apartments, each with the
  published weekly totals plus a `night_price`; `arrangement_fee` 100.
  `host_family` has no price (the brochure does not publish one) and stays
  unlinked to the catalog.
- Catalog consistency: the migration also adds the three published apartments
  the catalog was missing and corrects "Student Residence - Double Not
  Central" 27+ band from 140 to 130.
- Live QA must be done after the migration is applied.

## CI package manager: bun is the single source of truth (2026-09-24)

- **`bun.lock` is THE lockfile; CI installs with `bun install --frozen-lockfile`
  via `oven-sh/setup-bun@v2`.** There is no `package-lock.json` and there must
  not be one: two committed lockfiles drift apart and silently make CI build a
  different dependency tree than developers install. `--frozen-lockfile` is the
  drift guard — it fails the job if `package.json` and `bun.lock` disagree, so
  **any dependency change must be accompanied by a regenerated `bun.lock` in the
  same commit** (`bun install`, then commit).
- **`bunfig.toml` declares `minimumReleaseAge = 86400`** (skip versions
  published within 24h). This guard only applies to bun installs — an npm
  lockfile bypasses it entirely. Prefer bun for this reason when resolving
  dependencies.
- **Scripts (`npm run lint`, `npm test`, `npm run build`) still run through
  `npm`**, which resolves them from `node_modules`; installing with bun does not
  require npm for execution. No `--legacy-peer-deps` is needed: bun installs
  peer-only packages automatically (e.g. `@testing-library/dom`, required by
  `src/test/setup.ts`), so it must NOT be an explicit devDependency.
- **`@radix-ui/react-dialog` may stay a range in `package.json`** (`^1.1.15`)
  because bun honors the `overrides` entry (`1.1.23`) without npm's `EOVERRIDE`
  conflict. npm's resolver would reject that combination.
- **The build emits to `.output/public/assets`, NOT `dist/`.** The nitro
  cloudflare-module build writes `.output/`; the CI "Verify Lovable Cloud build
  binding" step must grep `BUNDLE_DIR=.output/public/assets`. `dist/assets` fails
  with "No such file or directory" even on a successful build. `.output` and
  `.wrangler` are gitignored.
- `npm run lint` exits non-zero (pre-existing debt) but is
  `continue-on-error: true`, so it does not fail the job.
- `src/data/intel/majorIntel.links.test.ts` is a **live external link checker**
  (fetches real university sites) and is therefore **opt-in**: it is wrapped in
  `describeNetwork` (`describe` only when `RUN_NETWORK_LINK_CHECK=1`, else
  `describe.skip`). `npm test` stays deterministic and never fails because a
  third-party site is slow or down — `uni-leipzig.de` intermittently returns
  HTTP/2 `INTERNAL_ERROR` and `uni-saarland.de` times out, which used to turn
  `main` red on its own. `major-intel-links.yml` sets the env var and runs it
  standalone (also bun-installed); that job is meant to go red on a real 404/410/5xx.

## Public office visit requests (2026-09-26)
- Public `/office-visit` uses a hashed 14-day opaque token and service-role-only booking RPC, because a case ID or phone number is not proof of ownership.
- A visitor's 10:00–18:00 Sunday–Thursday slot is a pending request until their assigned team member explicitly confirms it, because assignment must not silently promise availability or send confirmed-appointment automation.
- Public booking excludes overlapping one-hour office slots with a database exclusion constraint, because simultaneous applicants must not claim the same time.
- Landing translations exist in bundled `src/locales` and public `public/locales`; update both, because visitors render the bundled copy while other namespace loads may use HTTP.

## Bank details: one shared editor + server-authoritative chat share (2026-09-27)
- **One editor for every payout-earning role.** `src/components/common/BankDetailsEditor.tsx`
  is the single implementation (country selector IL/DE, dynamic field sets, validation,
  full column payload incl. `bank_country`/`bic`, and the confirmed lock). It replaces the
  previously orphaned common form (which lacked `bank_country`/`bic` and used legacy
  `influencer.earnings.*` keys) and the standalone `AgentBankDetailsPage` form (now a ~20-line
  wrapper resolving `useAuth()` → `<BankDetailsEditor userId>`). It uses `agent.bank.*`.
- **Surfaces:** `PartnerProfilePage` renders it after personal details (covers partner +
  ambassador, both on `/partner/profile`); the Agent surface is still
  `/agent/earnings?tab=bank` (and the `/agent/bank-details` redirect). `PartnerEarningsPage`
  gained a **Bank details / Bank details saved** shortcut next to the payout CTA linking to
  `/partner/profile` (boolean readiness only — no bank fields rendered there).
- **Chat share is now server-authoritative.** `BankDetailsShareDialog` takes a
  `bankDetailsPath` and always offers an **Add / Manage bank details** link (`chat.bankShare.addDetails` /
  `.manageDetails`); `DirectMessages` derives the path per role
  (`agent → /agent/earnings?tab=bank`, else `/partner/profile`) and
  `submitBankShare()` now calls the RPC `send_bank_details_to_admin(p_thread_id)` instead of
  sending a browser-built body. The RPC (migration `20260929000000_bank_details_chat_security.sql`,
  **MANUAL DEPLOY**) reads the caller's own saved `profiles` row, requires the caller to be a
  thread participant AND an admin participant, rejects empty details (`BANK_DETAILS_MISSING`),
  posts via `send_direct_message`, and tags the row `kind='bank_share'`. The body keeps the
  `::bank-details::` marker + camelCase JSON so `parseBankDetailsBody`/`BankDetailsCard` render
  unchanged.
- i18n: `chat.bankShare.{addDetails,manageDetails,missing}` + `partner.earnings.{bankDetails,bankDetailsSaved}`
  added to en + ar (parity-guarded). Orphan i18n left intentionally.
- Tests: `chatFormat.test.ts`, `common/__tests__/BankDetailsEditor.test.tsx`,
  `messages/__tests__/BankDetailsShareDialog.test.tsx`; `e2e/bank-details.spec.ts`
  (session-injected, skipped in CI). Build + `npx vitest run` 1484 pass.

## Role-aware notification settings (2026-09-27)
- `src/lib/notificationCategories.ts` is the single source of truth for which
  notification categories exist and which dashboard roles see them. Each entry
  is `{ key, column, roles }` where `column` is the `notification_preferences`
  `cat_*` boolean the push dispatcher gates on. `categoriesForRole(role)` is the
  one accessor the settings UI uses — never hardcode a category list again.
  A vitest guard asserts the component derives its switches from
  `categoriesForRole(role)`.
- `supabase/functions/_shared/notificationCategories.ts` is the deliberate Deno
  mirror (Deno cannot import from `src/`); `push-dispatch` imports
  `notificationCategoryColumn()` instead of its old local `CATEGORY_COLUMN`.
  `notificationCategories.test.ts` fails the suite if the two files drift,
  if a role list references an unknown category, if the SQL
  `notification_category_for_source()` emits a category missing from the
  catalog, or if an en/ar label is missing.
- **Matrix is evidence-based, not assumed.** Producers verified: messages
  (direct/case/whatsapp → all roles), appointments (notify_case_event +
  reminders → admin/team/student), cases (case events + referral_accepted +
  influencer created → all), payments (`payment_received`/`enrollment_paid` →
  admin + **team** + partner + student; payout status → requestor family),
  documents (document_requested/uploaded → admin/team/student; student upload
  notifies student), profile (no in-app producer found; DB link fallback maps
  to student — kept per product intent), recruitment (recruit_application →
  admin + agent; link fallback → /partner/network), calls (any direct-thread
  participant → all roles), system (welcome/digest/contact/custom → all).
  Notable deviation from the spec draft: **Team member also sees Payments**,
  because `notify_case_event` sends `payment_received`/`enrollment_paid` to the
  assigned team member.
- Role scoping is **display-only**: hidden categories are never written, and
  `savePreference` upserts the full existing row (`{...prefs, ...patch}`), so a
  hidden `cat_*` keeps its saved value and delivery is unchanged.
- `NotificationBell` takes a required `role: AppRole` prop (passed from
  `DashboardLayout`, which already has it) and forwards it to
  `PushNotificationSettings`. Role-specific labels/descriptions live under
  `pushSettings.categoryRole.<role>.<key>` and
  `pushSettings.categoryRoleDesc.<role>.<key>` (en + ar + he); the component
  falls back to the generic `pushSettings.categoryDesc.<key>` when a role has no
  override. Partner-family roles get "Referral milestones" for Cases and
  "Earnings" for Payments.
- No database schema change. Build clean; full suite `1477 passed | 1 skipped`.
- **Hebrew parity completed (PR #107).** The `he` `pushSettings` block was
  missing 39 of 62 keys (it predates role-aware settings — `he` had no
  `pushSettings` at all before PR #105). It was invisible because `src/i18n.ts`
  sets `fallbackLng: { he: ['en'] }`, so a missing key silently renders English,
  and `i18nKeys.test.ts` only checks `["ar","en"]`. All 39 are now translated;
  `en`/`ar`/`he` are 62/62 with no duplicates. No DB / edge-function /
  dependency change — locale JSON + test only.
- **The durable half of that fix is the guard, not the strings.**
  `notificationCategories.test.ts` now has `PRIMARY_LOCALES = ["en","ar","he"]`
  (was en/ar) plus a new `keeps every pushSettings key present in every locale`
  test asserting every `pushSettings` leaf key exists in every offered locale
  (verified to fail when one key is deleted). Consequence to remember: **any
  future PR adding a notification category must also supply Hebrew**, or the
  suite goes red. Still uncovered by this guard: the other Hebrew `dashboard.json`
  blocks (`chat`, `intel`, `team`).

## Major Card modal redesign — `/educational-programs` (2026-09-27)

- `src/components/educational/MajorModal.tsx` is a **shell-only redesign** of the
  public "expanded Major Card". UI + UX changed; **content/data is frozen** —
  same sections, order, copy, `majorLocale.ts` localization, and conditional
  suppression rules. No new CTA, cost figure, or subjects list was added (the
  data for those does not exist in `majorsData.ts`).
- **Built on Radix `Dialog` Root, not `DialogContent`.** It uses
  `DialogPortal` + `DialogOverlay` (exported from `ui/dialog.tsx`) plus a raw
  `@radix-ui/react-dialog` `DialogPrimitive.Content`, mirroring the
  `SearchAndFilter` / `PhotoLightbox` custom-overlay precedent. `DialogContent`
  was NOT reused (its baked-in centered/`sm:rounded-lg`/opaque overlay fights
  the spec), and `ui/dialog.tsx` is untouched, so every other dialog app-wide
  is unaffected. Root still gives focus trap, Esc, click-outside, and
  `react-remove-scroll` body lock for free.
- **Responsive shell**: mobile = bottom sheet (`inset-x-0 bottom-0`,
  `rounded-t-3xl`, `slide-in-from-bottom`); `sm+` = centered dialog
  (`sm:left-1/2 sm:top-1/2 sm:-translate-x/y-1/2`, `sm:max-w-[820px]`,
  `sm:rounded-3xl`). Backdrop is `bg-black/50 backdrop-blur-sm`. Entrance is
  `tw-animate-css` `data-[state=open]:fade-in-0` / `zoom-in-95` /
  `slide-in-from-bottom` (~200ms) with `data-[state=open]:motion-reduce:animate-none`
  + `data-[state=closed]:motion-reduce:animate-none` (the variant prefix is
  REQUIRED — a bare `motion-reduce:animate-none` is specificity 0,1,0 and loses
  to `data-[state=open]:animate-in` at 0,2,0, so the opt-out would silently do
  nothing). In RTL the
  physical `left-1/2 -translate-x-1/2` centering is direction-agnostic (a
  logical `start-1/2` would be wrong), so no `rtl:` override is needed.
- **Header owns the close affordance**: a sticky header with the name (h2) +
  German name and a `DialogPrimitive.Close` (×, `aria-label` `common.close`).
  `DialogTitle` is `sr-only` to keep the accessible name without duplicating
  visible text.
- **Token alignment** (card ↔ modal share the design language): all hardcoded
  `text-gray-*` / `border-purple-100` / `bg-white` / `bg-gray-50` swapped for
  semantic tokens (`text-foreground`, `text-muted-foreground`, `border-border`,
  `bg-card`, `bg-muted/50`). `MajorCard.tsx` gained an `active:scale-[0.99]`
  press state so the click reads as "expand" (hover lift unchanged).
- Guarded by `src/components/educational/__tests__/MajorModal.test.tsx` (5
  cases): null major renders nothing; a verified major keeps every existing
  section; a non-verified major suppresses verified-only sections; × and Esc
  both call `onClose`; body gets `data-scroll-locked` while open (Radix's
  `react-remove-scroll` locks via attribute + stylesheet, NOT inline style —
  asserting `body.style.overflow` would fail).
- **Dev-server caveat**: the Vite dev server intermittently throws
  `Failed to fetch dynamically imported module: …/CookieBanner.tsx` during
  dependency re-optimization. It is a pre-existing environment flake unrelated
  to this change; the production `npm run build` output and the unit tests are
  the reliable gates. `bun` is not on PATH in this image — install to
  `~/.local/bin` via the GitHub release zip (no `unzip` binary; use Python
  `zipfile`) and run `bun install --frozen-lockfile`.
- Build clean; `npx vitest run` 1498 passed | 1 skipped (+5 new).
## Hebrew localization complete (all pages/namespaces) — 2026-09-27
- Hebrew (`he`) now has **full key coverage across all 14 public namespaces**:
  `about`, `blog`, `broadcast`, `common`, `contact`, `dashboard`, `faq`,
  `landing`, `legal`, `partners`, `partnership`, `resources`, `services`,
  `whatsapp` — 0 missing keys (`scripts/check-he-locales.py`).
- `public/locales/{en,ar,he}` are the source of truth served by the HTTP
  backend (`/locales/{{lng}}/{{ns}}.json`). A subset ALSO exists under
  `src/locales/{en,ar,he}` and is imported eagerly in `src/i18n.ts`
  (`common, landing, contact, broadcast, legal`) so first paint never waits on
  the network. **These two trees must stay identical** — the sync has only ever
  been manual, which is exactly how Hebrew came to have
  `src/locales/he/contact.json` while every other bundled namespace was
  English-only (Hebrew first paint rendered English). Now mirrored for all five.
- New guard `src/lib/hebrewLocaleCoverage.test.ts`: every EN namespace must
  exist in `he` with **full leaf-key coverage**, and each `src/locales/he/*`
  bundled copy must **deep-equal** its `public/locales/he/*` counterpart. This
  is the regression fence — a new English string without Hebrew now fails CI.
  (Note: `src/i18n.ts` sets `fallbackLng: { he: ['en'] }`, so a missing Hebrew
  key silently renders English; only this guard catches it.)
- Two latently-untranslated **legal/factual** surfaces were created from
  scratch: `faq.json` (87 keys, source-backed answers on Bagrut recognition,
  Studienkolleg, uni-assist, blocked account, visa for Israeli passports,
  working/graduation) and `legal.json` (150 keys: privacy / terms /
  accessibility). Keep these aligned with their English originals whenever
  policy or official figures change — they are legally operative copy.
- Helper scripts (repo-utility, not runtime): `scripts/check-he-locales.py`
  (coverage report), `scripts/show-he-missing.py`, `scripts/merge-i18n-tsv.py`
  (path-safe TSV merger, the fastest way to translate a whole section without
  JSON-quoting overhead), `scripts/check-he-mixed.py` (flags Latin runs with
  Hebrew on **both** sides — the real half-translated-word signal; one-sided
  Hebrew-prefix + proper-noun like `ו-Studienkolleg` is a false positive).
- Build clean; `npx vitest run` 1528 passed | 1 skipped.

### Key presence is not translation — the value guard (2026-09-27)
- The coverage checks above only compare **leaf-key paths**. A Hebrew value
  copied verbatim from English satisfies them while still rendering English
  (and because `fallbackLng: { he: ['en'] }`, a missing value is
  indistinguishable from a deliberate fallback). An early pass of this work
  reported "0 missing keys" while ~29 user-visible strings were still English —
  including the homepage `studentGallery` (title, subtitle, every
  `destination: "Germany"` and the student names — `HomepageExperience` renders
  it via `src/pages/Index.tsx`), `nav.broadcast` / `seo.broadcastTitle`,
  `resourcesPage.badge`, the `servicesHero` / `partnershipHero` /
  `broadcastHero` eyebrows, `homepage.hero.eyebrow` and
  `costCalc.transportLabel`.
- `hebrewLocaleCoverage.test.ts` now has a second assertion,
  `has translated Hebrew values, not English copies`: a key must be translated
  when **English and Arabic differ and the Arabic value contains Arabic script**.
  Arabic is used purely as evidence that a string is translatable, so this
  cannot invent work for proper nouns. `IDENTICAL_BY_DESIGN` exempts URLs,
  asset paths, element ids, placeholders and short codes — and is kept
  deliberately NARROW: a wide pattern is itself a silent hole. Do **not** add
  `brand`/`campaign`/`icon` (they hold user-visible brand words Arabic
  translates: `Darb` → `درب`) or `.value.` (the spreadsheet value labels mix
  prose with proper nouns like `PayPal`, so a blanket exemption hides
  regressions). A first pass of this guard exempted both and hid two untranslated
  keys (`landing.homepage.hero.campaign`, `blog.brand`); both are now translated
  as `דארב` and the exempted-pattern regression is caught.
  Verified non-vacuous: reintroducing an English `studentGallery.title` or
  `blog.brand` fails it.
- Consequence to remember: **adding a new English string that Arabic also
  translates now requires Hebrew, at the value level**, not just a stub key.
- Three keys stay intentionally non-Hebrew and are covered by the exemptions:
  the German word `Studienkolleg` (rendered `Studienkolleg (שנת מכינה)`),
  `Europass (אירופס)`, and the `Deutschlandticket` ticket name.
- `team.appointments.labelTimeRange` was also **rewritten** in the original pass
  (EN `(8 am – 8 pm)` / AR `(8 ص – 8 م)` → HE `(8:00–20:00)`). A translation PR
  must not change meaning; it is now `(8:00 – 20:00)` — same 12-hour form as
  EN/AR.

### Native-review gate for legal / FAQ Hebrew (OPEN — do not treat as reviewed)
- `public/locales/he/legal.json` (privacy policy, terms of use, accessibility
  statement) and `public/locales/he/faq.json` (Bagrut recognition,
  Studienkolleg, uni-assist, the blocked account, the Israeli-passport visa
  route, working after graduation) are **newly authored Hebrew**, not
  professionally reviewed. They carry legally operative copy and cite official
  figures (EUR 11,904 / 992 blocked account, 140 full days, the 18-month
  post-study permit) and source URLs.
- `src/lib/consent.ts` ties `POLICY_VERSION` to this copy, so it must be
  reviewed by a qualified native Hebrew speaker — and for the privacy/terms
  text, by someone able to confirm it matches the English operative meaning —
  before it is relied on. Treat this as an operator/reviewer decision; nothing
  in the repo enforces it.
- The earlier `PENDING_NATIVE_REVIEW` exemption in the coverage test was
  **removed** (its lists are now empty) because key coverage is complete. That
  removes the *mechanical* reminder, not the review obligation above.

### Repo hygiene
- `scripts/mirror-he-bundled-locales.py` mirrors `public/locales/he/*` into the
  eagerly-bundled `src/locales/he/*` (the two must stay byte-identical; the
  coverage test enforces it). It was originally committed at the repo root as
  `.tmp_he_bundle.py`, which was wrong — temp files do not belong at the root
  and every sibling is documented under `scripts/`.

## Major Card modal — in-card section navigation (2026-09-27)
- `src/components/educational/MajorModal.tsx` is the public expanded Major Card
  (clicking a card on `/educational-programs`). It has a persistent pill rail in
  the **sticky header** so a reader jumps to a section instead of scrolling to it.
  It reuses the shell from PR #109 (centered rounded dialog, blurred backdrop,
  mobile bottom-sheet) — the rail is additive; copy/suppression rules unchanged.
- **Nav entries are derived from what actually renders, never hardcoded.** The
  same conditional expressions that gate each section also `push()` its nav
  entry, so a suppressed section (no verified data) can never appear in the rail
  and a shown section is always reachable. `sections.length > 1` hides the rail
  entirely for a bare major (the "Description"-only case), where a one-item nav
  would be pure noise. A test asserts every rail entry has a real heading.
- **Active-section tracking**: rAF-throttled `scroll`/`resize` listener on the
  dialog body, cached `getBoundingClientRect()` diff against the container top
  (threshold 96px ≈ the sticky header). Both ends are pinned (`scrollTop <= 0`
  → first section, `scrollTop + clientHeight >= scrollHeight - 2` → last), so a
  major whose content is shorter than the viewport doesn't highlight the last
  section on open. The listener is attached to the dialog body, not `window`,
  because `document` is not the scroller inside a Radix dialog.
- **Radix portal gotcha (this was the bug that broke the first implementation)**:
  `DialogPrimitive.Content` renders through a portal mounted in a *later commit*
  than the component that declares the effect, so `scrollRef.current` was still
  `null` when the effect first ran and the effect never re-ran → nothing was ever
  highlighted. Fixed by holding the node in **state** via a callback ref
  (`const [scrollEl, setScrollEl] = useState<HTMLDivElement|null>(null)`;
  `ref={setScrollEl}`) and keying the effect on `scrollEl`, so setup runs when the
  node actually attaches. Do not "simplify" this back to a plain `useRef`.
- `scroll-mt-24` on each section div offsets the sticky header for the smooth
  `scrollIntoView({ behavior: 'smooth', block: 'start' })`; `aria-current="true"`
  marks the active pill. Rail is RTL-safe (`dir` inherited, no physical props).
- i18n: one new key `educational.navSections` (the `<nav aria-label>`) added to
  en + ar + he in BOTH locale trees — `src/locales/*` (bundled) AND
  `public/locales/*` (HTTP-served) — because the sync guard compares them. Note
  pre-existing drift: `public/locales/{en,ar}/common.json` carry `edImageAlt` /
  `imageAlt` that `src/locales/{en,ar}` lack; `he` is in sync. Don't "fix" that
  by copying files wholesale — it is unrelated to this feature.
- Build clean; `npx vitest run` 1538 passed | 1 skipped (+5 `MajorModal` nav
  cases incl. the "every entry has a heading" contract and the sparse-major
  suppression case). The dev server here has a pre-existing
  "Failed to fetch dynamically imported module" flake on first load (retry/Try
  Again loads fine); verification was done via the suite + a static check of the
  built bundle, not the browser.

## Bank account holder (beneficiary) name — added (2026-09-27)
- **Gap found**: the shared bank editor collected only the BANK's name
  (`profiles.bank_name`), branch, account number, IBAN and BIC — there was no
  field for the *account holder* (the person/entity owning the account), which
  payouts need. `bank_name` is the institution ("Bank Hapoalim"), NOT the
  beneficiary, so the two must not be conflated.
- **New column** `profiles.bank_account_holder text` (migration
  `20260930000000_bank_account_holder.sql`, MANUAL DEPLOY — `supabase db push` /
  dashboard SQL editor; the Vercel build and `ci.yml` never apply DDL).
- `restrict_profiles_write` recreated VERBATIM from `20260928110000` with ONE
  addition: `bank_account_holder` joins the confirmed-bank guard, so once
  `iban_confirmed_at` is set a non-admin cannot redirect a verified payout by
  swapping only the beneficiary name. **Timestamp must stay newer than
  `20260928110000`** — an out-of-order re-run of the older file would drop the
  guard.
- `send_bank_details_to_admin` recreated to read and emit the holder: JSON key
  `bankHolder` sits right after `bankCountry` (key order must match
  `BankDetailsPayload`), and the human fallback block gains an `Account holder:`
  first line. The emptiness check (`BANK_DETAILS_MISSING`) now also considers the
  holder.
- **Single source of truth, do not fork**:
  `src/components/common/BankDetailsEditor.tsx` (one editor for
  Partner/Ambassador/Agent) gained the holder input in BOTH the IL and DE
  branches and requires it on save (`agent.bank.errHolder`) — a payout row
  without a beneficiary is not usable. `src/lib/chatFormat.ts`
  (`BankDetailsPayload.bankHolder`, `buildBankDetailsBody`,
  `parseBankDetailsBody`, `hasBankDetails`) is the one parser;
  `BankDetailsCard` + `BankDetailsShareDialog` render the holder row;
  `DirectMessages` selects + maps it; `PartnerEarningsPage`'s payout-readiness
  boolean counts it.
- i18n: `agent.bank.accountHolder/accountHolderPlaceholder/accountHolderHint/errHolder`
  and `chat.bankShare.accountHolder` added to en + ar + he `dashboard.json`.
- Tests: `BankDetailsEditor.test.tsx` +1 case (**holder required even when every
  other IL field is filled**) and the empty-form case now asserts `errHolder`;
  `chatFormat.test.ts` + `BankDetailsShareDialog.test.tsx` payloads extend and
  assert the holder round-trip.
- Build: `npm run build` (tsc+vite) clean; `npx vitest run` 1562 passed | 1
  skipped. A separate commit on the same PR (`2055a82`) repaired a
  **main-branch regression** that had turned CI red for every PR:
  `WhatsAppService.ts` (`e1b75a2`) added a module-level
  `supabase.auth.onAuthStateChange(...)` side effect while
  `whatsappMerge.test.ts` mocked the client as `{ supabase: {} }`, so
  `supabase.auth` was undefined and the whole suite file failed to load before
  running a single test. Fixed test-only by giving the mock the
  `auth.onAuthStateChange` surface it calls — matching sibling mocks such as
  `DataRequestsPanel.test.tsx` (which mocks `auth.getUser`). **Rule: any test
  that mocks `@/integrations/supabase/client` must expose every client surface
  the imported module touches at module scope**, or the file fails to load.


## WhatsApp workspace split (2026-09-28)
- `src/pages/messages/WhatsAppInboxPage.tsx` was a 1,349-line monolith. It is
  now 1,225 lines with the reusable pieces under
  `src/components/messages/whatsapp/`: `constants.ts` (filter/taxonomy
  vocabulary + `threadNeedsReply`), `format.ts` (`fmt`/`fmtDay`/`initials`/
  `deliveryMark`), `ConversationRow.tsx`, `MessageList.tsx` (owns the
  ai-elements `Conversation` scroll container — do not re-inline it),
  `WhatsAppActions.tsx`, `TagEditor.tsx`, `Metric.tsx`, `MediaBubble.tsx`.
- The page still re-exports `ConversationRow` (`export { ConversationRow }`)
  because `src/pages/messages/__tests__/WhatsAppInboxRow.test.tsx` imports it
  from the page path. Keep that re-export until the test is repointed.
- **What was deliberately NOT extracted:** the list pane, composer,
  conversation header, lead panel, templates/overview panels and the
  `startDialog`/`conversationOnlyView` fragments. They close
  over ~15+ `useState` values plus `active`/`messages`/`threads`, so extracting
  them means 20-40-prop drilling that would make the code worse, not better.
  The right next step is **state hooks** (`useWhatsAppThreads`,
  `useWhatsAppConversation`, `useWhatsAppComposer`), not more JSX moves.

- Removed on the way: the dead `Field()` helper, and the now-unused
  `ConversationState`/`LeadStage`/`Shimmer`/`Tag` imports.
- The new modules are prettier-formatted and lint-clean. The page itself still
  carries ~383 pre-existing `prettier/prettier` errors (minified one-line JSX
  style predating this work); they are NOT build-gated. Do not run
  `eslint --fix` on the whole page in an unrelated PR — it inflates the diff.
- Localization note: quick replies were hardcoded Arabic (`QUICK_REPLIES_AR`)
  while the appointment-template presets still are
  (`APPOINTMENT_TEMPLATE_PRESETS_AR`). Audience is Arabic-only for now, so the
  presets were left as-is, but any future Hebrew/English staff rollout must
  localize them too.

## WhatsApp: Admin/Team view switch removed (2026-09-28)
- The WhatsApp workspace had an in-page segmented **Admin / Team view** toggle
  (`adminTeamPreview`), rendered only for admins, that let an admin preview the
  simplified team inbox. It was removed: the control was dead on the pinned team
  route, and workspace mode should be a function of route + role, not UI state.
- `teamMode` is now `const teamMode = inboxOnly;` — a team member (or an admin on
  `/team/whatsapp`) is pinned to the simplified inbox; an admin on
  `/admin/whatsapp` gets the full workspace.
- **The team-mode capability is deliberately KEPT** (this is not a feature
  removal). An admin still grants a team member WhatsApp access via
  `profiles.whatsapp_inbox_enabled` (`useWhatsAppInboxAccess`); that access
  renders through the same `if (teamMode)` branch and `inboxOnly` prop as
  before. Do **not** delete `if (teamMode)`, the `teamMode` conditionals, or
  `inboxOnly` — that would break the team member's assigned-only inbox.
- Removed along with the control: the `adminTeamPreview` state, the
  `adminTeamToggle` JSX, both render sites (the team-branch header and the
  admin-branch bar), and the now-orphaned `tabs.admin` / `tabs.team` /
  `tabs.viewToggle` locale keys (en + ar + he).
- Guarded by `src/pages/messages/__tests__/whatsappViewSwitchGuard.test.ts`
  (source scan): asserts no `adminTeam*` symbol or `tabs.team` key returns,
  that `teamMode` derives from `inboxOnly`, and that `if (teamMode)` survives.
  Verified non-vacuous — reintroducing the toggle fails 2 of the 4 cases.
- Build clean; full suite green (1628 passed | 1 skipped, +4 new).

## Arabic/Israel SEO hardening (2026-09-28)

Audience is Arabic-speaking Israeli Arabs, mobile-first; Hebrew/English
indexability is explicitly deferred (plan: `.agents_tmp/PLAN.md`, phases 1-4).

- **All structured data is server-rendered through route `head()` scripts**,
  never a client effect. The root entity graph (`Organization` + `WebSite` +
  `EducationalOrganization` + `LocalBusiness`) lives in `src/routes/__root.tsx`
  `head()` as `scripts: [{ type: "application/ld+json", children }]`; TanStack
  Router serializes `head()` scripts into the SSR HTML (see
  `buildTagsFromMatches` in `@tanstack/react-router`). It used to be injected
  by a `useEffect` mutating `document.head`, so non-JS crawlers saw **zero**
  JSON-LD. **Never move it back to a client effect.**
- **Page schema also goes through `head()`.** `SEOHead`'s `jsonLd` prop is
  client-only (crawlers miss it) and was therefore REMOVED from every public
  page, which also prevents the same schema being emitted twice after
  hydration. Emitted per route: `FAQPage` (`/faq`), `Service` + `OfferCatalog`
  (`/services`), `CollectionPage`/`ItemList` of `Course`s
  (`/educational-programs`, from `src/data/majorsData.ts`), `Blog` +
  `BlogPosting`s (`/blog`), `Article` (`/blog/$slug`), and `BreadcrumbList` on
  every public page.
- **`head()` runs on every SSR request, before lazy route modules load.** A
  route file therefore cannot read a non-eagerly-bundled namespace (blog, faq,
  services, …) through `routeText()` at SSR time — those load via HttpBackend
  at render. The fix is to **import the locale JSON directly** in the route
  module (`import arFaq from "../../public/locales/ar/faq.json"`, plus en/he)
  and pick with `pickLang({ ar, en, he })`. This keeps ONE source per page and
  is SSR-safe; it is the pattern used by `/faq`, `/services`, `/blog`,
  `/blog/$slug`. Keys in `common` and the other eagerly-bundled namespaces
  (`landing`, `contact`, `legal`, `broadcast`) are read through `routeText()`.
- **`src/lib/routeMeta.ts`** — `routeText(key, ns = "common")` reads the i18n
  instance's bundled resources (falls back to Arabic, then the key) so route
  metadata and `SEOHead` share one source; `pickLang({ ar, en, he })` picks the
  active language from directly-imported dictionaries; `jsonLdScript(payload)`
  builds the `head()` script object (escapes `<` so a locale string can't close
  the tag). Do not re-hardcode Arabic metas in route files for `common` keys.
- **Page structured data is emitted through route `head()` scripts, not
  `SEOHead`'s `jsonLd` prop** (which is client-only, so crawlers miss it). The
  `jsonLd` prop was removed from every public page to avoid emitting the same
  schema twice after hydration: FAQ (`FAQPage` from the faq locale JSON),
  `/services` (`Service` + `OfferCatalog` from the services locale JSON),
  `/educational-programs` (`CollectionPage`/`ItemList` of `Course`s from
  `src/data/majorsData.ts`), `/blog` (`Blog` + `BlogPosting`s from
  `src/content/blog`), `/blog/$slug` (`Article` + `BreadcrumbList`), plus
  `BreadcrumbList` on every public page.
- `SEOHead` gained an `ogType` prop (default `"website"`) so the article route
  passes `"article"`; without it the client effect would flip the SSR
  `og:type` back to `website` on hydration.
- **`src/config/localBusiness.ts`** — `DARB_OFFICE` is the single on-site
  description of the Tamra office (address, `addressCountry: "IL"`, phone from
  `SUPPORT_PHONE`, Sun–Thu hours). The JSON-LD imports it, so local-entity data
  cannot drift from the contact UI.
- **`src/lib/breadcrumbs.ts`** — `buildBreadcrumbList(crumbs)` is the one
  `BreadcrumbList` builder (`@context` + canonical-origin absolute `item`s),
  used by every public page; guarded by `src/lib/breadcrumbs.test.ts`.
- **`src/lib/seoStructuredData.test.ts`** is the schema fence: it fails if any
  page reintroduces `jsonLd={`, if a public route loses its `head()` scripts, if
  a localized route regresses to hardcoded Arabic meta literals, or if
  `jsonLdScript` stops escaping `<`.
- **`src/lib/seoHygiene.test.ts`** is the regression fence: sitemap has no
  `/who-we-are` and every entry has `<lastmod>`, robots disallows `/agent` +
  the private families, `DARB_OFFICE` publishes an Israeli address, and the
  root route emits JSON-LD via `head()` **scripts** (and does not contain
  `rootJsonld`, the removed client-effect marker).
- Crawl hygiene: `robots.txt` gained `/agent`, `/invoice`, `/apply`, `/join`,
  `/office-visit`, `/book-appointment`; `noindex, nofollow` added to
  `/invoice/$token` and `/student-auth` via route `head()`. Verified on the
  **live domain** that `/sitemap.xml` (200, `application/xml`) and `/robots.txt`
  (200, `text/plain`) are served, not rewritten to the shell, and
  `/who-we-are` is a real 404 — so no `vercel.json` change was needed.
- **robots exclusion is prefix-based, so a bare `Disallow: /partner` also hides
  the public `/partnership` page** (and `/partners`, the redirect) that the
  sitemap advertises. `robots.txt` therefore pairs the prefix rule with explicit
  `Allow: /partnership` / `Allow: /partners`; per RFC 9309 the longest match
  wins, so `/partner/earnings` stays disallowed while the public pages resolve to
  Allow. Guarded (with a real longest-match resolver) by `seoHygiene.test.ts`.
  When adding a private prefix, always check whether a public sibling shares it.
- **Every public route declares its own canonical + `og:url`.** A route `head()`
  that omits `links` inherits the root's `og:url` (the homepage) and ships **no
  canonical**, so a crawler is told every page is a duplicate of `/`. `about`,
  `contact`, `locations`, `partnership`, `educational-destinations` were missing
  both (and `services`/`resources`/`educational-programs` were missing
  `og:url`); all now declare `links: [{ rel: "canonical", … }]` + `og:url`,
  matching the routes that already did. Guarded per-route by
  `seoStructuredData.test.ts`.
- **`/educational-programs` `ItemList.numberOfItems` must equal the emitted
  `itemListElement` length.** It previously announced 73 but sliced to 30 (a
  leftover client-side cap while the page renders all 73), which both failed
  validators and dropped 43 courses from the structured data. The slice is
  removed; the count and the list come from the same array (73 = 73).
- Build clean; `npx vitest run` 1628 passed | 1 skipped (96 files); eslint 0
  errors on all touched files. Dev-server SSR spot-check confirmed
  `addressCountry: "IL"`, `areaServed` Israel, and the entity graph + page
  schema + a `BreadcrumbList` in the initial HTML for `/`, `/about`,
  `/services`, `/faq`, `/blog`, `/educational-programs` (with `FAQPage`
  appearing exactly once — no double emission), self-referential
  canonical/`og:url` on every public route, and a matching ItemList count.



## DARB payment proof + wire memo (2026-09-29, updated 2026-09-29)
- DARB fee stays one full payment. `confirm_agency_service_payment(case, method, p_reference, p_receipt_path)`: the server no longer requires proof — when no bank reference is supplied it stamps the auto-generated `cases.case_reference` as the payment reference. Wire memo reference = `cases.case_reference`, shown on Finance tab, student Fees, invoice page/PDF/email. Germany block is a collapsible "Step 2".
- **The Finance tab (pipeline) collects NO proof.** The optional "Transfer reference" input and the "Receipt (file)" input were REMOVED from `CaseFinance.tsx`; staff pick the payment method and confirm — the reference is auto-generated server-side. The call passes only `p_case_id` / `p_payment_method`. `src/lib/agencyPaymentProof.ts` (+ its test) was deleted; the `finance.receipt.{optional,upload,hintAuto,required,tooLong,hint}` locale keys were pruned from en/ar/he (kept: `reference`, `view`, `openFailed`, still used by `CasePayments` history). Guarded by `src/lib/agencyPaymentNoProofGuard.test.ts`.

## Post-arrival Visa workflow — Admin Pipeline third tab (2026-09-29)
- **Visa is NOT a `cases.status`.** `enrollment_paid` stays the terminal
  success state; `caseStatus.ts` / `caseTransitions` / `TERMINAL_STATUSES` /
  `CaseStageService` / `caseTasks.ts` / commission logic are all UNCHANGED.
  Visa is a post-enrollment operational queue layered on enrolled cases. Do
  not add `visa` to `CaseStatus` or an `enrollment_paid -> visa` transition.
- Route: `/admin/pipeline?tab=visa` (third tab in `AdminPipelineHubPage.tsx`,
  `Globe` icon, `nav.visa`). A thin `src/routes/admin.visa.tsx` redirects
  `/admin/visa` -> `?tab=visa`, mirroring `admin.submissions.tsx`. `TabHub`
  still handles URL state + lazy mounting (only the active tab mounts), so the
  Visa page never loads unless requested.
- **Arrival is its own marker.** `visa_applications.arrived_in_germany_at`
  (nullable) is the operational source of truth for the queue;
  `profiles.arrival_date` stays the PLANNED date and is never overwritten
  (only prefilled). A student enters the working queue only when arrived.
- **Queue**: admin-gated SECURITY DEFINER RPC `get_admin_visa_queue()`
  (enrolled + `student_user_id IS NOT NULL` + active/not-archived) - returns
  only the columns the queue renders, never a wildcard, and reads
  `visa_status` from the canonical `visa_field_values` (no new status store).
  `src/lib/visaStatus.ts` owns sectioning (`groupVisaQueue`,
  `visaQueueSection`, `visaQueueCounts`, `normalizeVisaStatus`) + the readiness
  calculator; `useVisaQueue` fetches it whole (small), `useVisaDetail` loads
  the heavy per-student data only when a case is opened (the queue query is
  NOT fanned out - no N+1, no per-student document preloading). Queue lists
  paginate client-side via `usePagination`/`TablePagination`.
- **Documents are never copied.** `visa_application_documents` is a relational
  join (UNIQUE per pair) that records WHICH existing `documents` rows were
  selected. Removing a selection deletes ONLY the link row; the file stays in
  the private `student-documents` bucket and is read through short-lived signed
  URLs (`createVisaDocumentUrl`) - never `window.open(publicUrl)`. Legacy
  `visa_applications.*_url` columns are kept and surfaced as fallback links.
- **Status**: the canonical dynamic `visa_fields`/`visa_field_values`
  (`field_key = 'visa_status'`) is the one status store; values are
  `not_applied | applied | approved | rejected | received`. Never add a second
  store. `visa_field_values` stays the single writer via `writeFieldValue`.
  Legacy `profiles.visa_status` is NOT synchronized - it would create drift.
- **RLS** (migration `20260930120000_post_arrival_visa_workflow.sql`, MANUAL
  DEPLOY): the new table follows the existing read-only-team posture - Admin
  `FOR ALL`, Team `SELECT` scoped to assigned cases, Student `SELECT` own;
  students get NO write (document selection is an Admin responsibility). This
  matches `20260814000000` exactly; no existing policy is weakened.
- **Audit** reuses `case_events` (`is_internal = true`):
  `student_arrived_in_germany`, `visa_file_started`,
  `visa_document_attached`/`_removed`, `visa_application_submitted`
  (status->applied, sets `visa_applied_at` + optional `submission_snapshot`),
  `visa_approved`/`visa_rejected`/`visa_received`. Icons registered in
  `caseEventMeta.ts`.
- `visa_applications` rows are created LAZILY (Mark as Arrived / Start Visa
  File / first status change), never pre-created to fill a queue; `case_id`
  uniqueness is preserved. Students keep using `/student/visa` - one shared
  data flow through `visa_field_values` + `documents`.
- i18n: `admin.visa.*` + `common.yes/no/saved` added to en + ar + he
  `dashboard.json` (parity-guarded by `i18nKeys.test.ts` +
  `hebrewLocaleCoverage.test.ts`). No hardcoded UI strings: the queue row and
  every section title go through `t()` — never an inline `isAr ? ... : ...`.
  **A `t()` key must never resolve to an object.** `admin.visa.status` is the
  status NAMESPACE (`status.not_applied` …), so the section title uses the
  separate leaf `admin.visa.statusLabel`; i18next returns the diagnostic string
  `key '...' returned an object instead of string` (truthy, so the English
  fallback never applies) when a namespace is used as a leaf.
  `i18nKeys.test.ts` now has a `never resolves a t() key to an object` guard —
  it skips `t(key, { returnObjects: true })` call sites, which resolve to
  objects by design.
- Tests: `src/lib/visaStatus.test.ts` (13 cases - sectioning incl. scenarios
  1/2, counts, readiness, status normalization). Build clean; `npx vitest run`
  1657 passed | 1 skipped.

## Post-arrival Visa workflow — audit fixes (2026-09-29)

Full-repo QA audit of `Enrollment → Student Account → Payments → Enrolled →
Post-Arrival Visa` on `origin/main` (`3641432`, PR #122). Four real defects
found; the backend (migrations `20260930120000`, `20260930130000`) was sound —
only the frontend reachability was broken.

- **`tsc` was RED on `main`.** `src/components/admin/visa/VisaQueue.tsx` used
  `FileCheck2` in `SECTION_META.applied` without importing it (the other 6 lucide
  imports were dead leftovers). Fixed by importing `FileCheck2` and dropping the
  unused imports. This note originally claimed `.github/workflows/ci.yml` runs
  `npm run build` = `tsc && vite build` — **that was wrong**: build is `vite build`
  only, which is why `main` could ship a type error that local `vitest` did not
  catch. Corrected on 2026-09-29, when a blocking `npm run typecheck` step was
  added to the `quality` job. When verifying this repo, run `npx tsc --noEmit` —
  `vitest` passing is not sufficient.
- **i18n guard RED on `main`.** `VisaQueue.tsx` calls `admin.visa.pending` and
  `admin.visa.applied`; neither key existed in en/ar/he (the block had
  `emptyPending`/`emptyApplied` but not the section labels). Added to all three.
- **Student Visa saves were silently impossible (functional blocker).**
  `StudentVisaPage.saveDynamic` upserted the ENTIRE field set (every row of
  `visa_fields`, including `visa_status`) into `visa_field_values`.
  `20260930130000` added "Students insert/update own non-status visa values"
  policies whose `WITH CHECK` requires `vf.field_key <> 'visa_status'`, so the
  multi-row upsert failed the whole statement with an RLS violation — the student
  could not save ANY visa field. Fixed by filtering to
  `f.field_key !== "visa_status"` before the upsert (and bailing out when no
  editable fields remain). **Rule: a client upsert that spans student-writable
  and admin-only rows will fail as a unit — never send the mixed set.**
- **The student submit flow had no UI.** PR #122 added
  `ensure_student_visa_application`, `mark_student_visa_arrived` and
  `submit_student_visa_application` (security-definer, ownership + enrollment +
  arrival + required-field validated, idempotent, writes a `submission_snapshot`,
  logs `visa_application_submitted`, dedupe-keyed notifications to admins) plus
  `VisaService` wrappers — but `grep` showed the wrappers were called by
  **nobody**, and `StudentVisaPage.tsx` did not import `VisaService` at all. The
  intended flow ("student fills visa fields in their dashboard, confirms, then
  admin copies the info into the Heidelberg portal") was therefore unreachable,
  and the admin Ready queue could never fill besides via the admin's own Mark
  Arrived. Wired into `StudentVisaPage.tsx`: a "Submit for Administration" card
  gated on `caseStatus === "enrollment_paid"` (+ an arrival-confirmation control,
  since the RPC requires `arrived_in_germany_at`), resolving the case through the
  `get_my_case` RPC and excluding archived cases. Both actions stay UI-gated only
  for UX — the RPC is the trust boundary.
- **New guard** `src/lib/visaStudentFlowGuard.test.ts` (5 cases, verified
  non-vacuous): the save path must filter `visa_status`, the submit must go
  through the RPC and never a direct `visa_applications` write, arrival
  confirmation must exist, the actions must be enrollment-gated, and `visa` must
  never appear in `CaseStatus`.
- Locale edits are **insertion-only** (do not re-sort the whole `visa` block —
  it produces a ~94-line churn diff of pure reordering).
- Build/test after fixes: `npx tsc --noEmit` clean; `npx vitest run`
  1664 passed | 1 skipped (104 files, +5 new); `npm run build` clean. The
  pre-existing `npm run lint` debt is unchanged and `continue-on-error: true`.

## Tabbed submission case card — Admin Submissions queue (2026-09-29)
- The Admin Submissions dialog used to render Basic Info → Payment Details →
  Program/Accommodation → Student Profile Data → `CaseFinance` →
  `CaseInvoiceBlock` → Documents as ONE long vertical scroll. It is now a
  six-tab strip: **Overview** (default) / Profile / Program / Finance / Invoice /
  Documents. Pure presentation regrouping — **no query, RPC, RLS or migration
  changed**.
- `src/components/admin/SubmissionCaseTabs.tsx` is the new presentational body
  (no fetching, no page state). `AdminSubmissionsPage` keeps the dialog shell:
  header, the persistent status strip, the action footer, and the
  Return-for-changes / Payment-Split / password-gate dialogs.
- **`SubmittedCase` is exported from the component and re-imported by the page.**
  One definition — do not reintroduce a second copy in the page.
- **Every panel is `forceMount`ed + `data-[state=inactive]:hidden`. This is
  load-bearing, not cosmetic.** `CaseFinance` pushes its Germany-payment
  readiness up via `onReadinessChange`, and the page gates **Mark as Enrolled**
  on that snapshot (`germanyConfirmedRequired < germanyRequiredTotal`). Radix
  unmounts inactive `TabsContent` by default, so without `forceMount` the Finance
  panel never mounts while the admin sits on Overview → readiness never arrives →
  **Mark as Enrolled is permanently disabled** until the admin opens Finance.
  Mirror the nested-tabs pattern already in `CaseFinance.tsx`. The 5th test case
  (`reports Finance readiness while the Overview tab is active`) is the guard —
  verified non-vacuous by removing `forceMount` and watching it fail.
- **Program** and **Documents** triggers derive from the SAME boolean as their
  content, so a tab can never appear without content. Six triggers do not fit a
  phone width as a grid → the `TabsList` scrolls horizontally.
- Status / payment-method / enrolled badges moved ABOVE the strip so they are
  visible from every tab (previously only at the bottom of the scroll).
- Removed the hardcoded, untranslated `"DARB service total: Calculated in the
  Finance section above."` row — with tabs there is no "above", and the Total row
  below it already renders the authoritative `totalFee()`. No new key was added
  for it.
- Dialog widened `sm:max-w-2xl` → `sm:max-w-4xl` for the Finance KPI grid.
- i18n: `admin.submissions.tabs.*` added to **en + ar + he** with real
  translations (he must not copy en — the value-level guard in
  `hebrewLocaleCoverage.test.ts`). Terminology reused from the existing
  dictionaries (`نظرة عامة` / `סקירה כללית`, `admin.students.tabs.*`).
- Tests: `src/components/admin/__tests__/SubmissionCaseTabs.test.tsx` (5 cases).
  It resolves `t()` against the real `public/locales/en/dashboard.json`, so the
  asserted labels are the shipped ones and the keys are proven to exist. Role
  queries are scoped to the OUTER tablist — `CaseFinance` renders its own nested
  Summary/Invoice tablist and a bare `getByRole("tab")` matches those too.
- Build/test: `tsc` clean; `npx vitest run` 1669 passed | 1 skipped (105 files);
  `npm run build` clean. New files are eslint-clean; the page went 174 → 171
  pre-existing prettier errors (net improvement — do NOT `eslint --fix` the whole
  page in an unrelated PR).
- Not verified in a browser: RTL tab order and phone-width horizontal scroll are
  reasoned from `TabsList` styles, not observed.

## Dialog primitive: mobile width + export-completeness guards (2026-09-29)
- **`DialogContent` must stay in `dialog.tsx`'s export block.** Commit `f03c73d`
  (#128) removed it while leaving the component defined above, so the file read
  correctly but every importer got `undefined`. Measured on `origin/main`:
  `vite build` fails with **34 `MISSING_EXPORT` errors** (rolldown prints the
  total in its header and details only the first 5), **24 unit tests** fail
  across 5 files, and `main`'s `quality` workflow is red.
- **Correction to a claim this note previously made:** `tsc` DOES catch it.
  `npx tsc --noEmit` (the root `tsconfig.json`, which actually covers `src/**`)
  reports `TS2459: Module '…/dialog' declares 'DialogContent' locally, but it is
  not exported` across ~34 files. The earlier "tsc does not catch it" was wrong;
  the real reason CI missed it is that **`package.json`'s `build` script is only
  `vite build` — there is no `tsc` in the build or in the `quality` job**, so
  typechecking never runs. Do not rely on `--noEmit` being wired up; it is a gate
  you have to run by hand.
- **`f03c73d` also introduced `DialogDescription.displayName =
  DialogDescription.displayName`** — a self-assignment. As a live binding the
  read precedes the write, so it throws `TypeError` at module evaluation. It
  survives `tsc` (the binding's type is non-`undefined`) and the whole vitest
  suite, because every dialog-consuming test file mocks the dialog module.
  `eslint` flags it (`no-self-assign`) but the `quality` job runs lint with
  `continue-on-error: true`, so it blocks nothing. Fixed; guarded.
- Guarded by `src/components/ui/__tests__/dialogContent.contract.test.ts`, which
  asserts (a) every declared `forwardRef` component is exported, (b) no
  `displayName` is assigned to itself and each is wired to its Radix primitive,
  and (c) the mobile grid-item rule is present, `max-sm`-scoped, and read from
  the base class literal. Assert on **the class literal**, not the whole file — a
  naive `source.toContain(...)` is vacuous because the explanatory comment also
  names the utility (this bit the first version of the guard). Verified
  non-vacuous by reintroducing each defect.
- **A dialog's single implicit `grid` track sizes to the largest MIN-CONTENT
  contribution of its children.** With a wide child (the Admin Submissions
  `w-max` six-trigger tab strip) the track inflated to ~524px inside a 359px
  dialog and the dialog's own `overflow-x-hidden` then **CLIPPED** the strip
  instead of letting it scroll — the strip was unreachable on a phone. The
  earlier note that phone-width scrolling was "reasoned, not observed" was wrong:
  measured in headless Chromium, it did not scroll.
- **Fix: `[&>*]:max-sm:min-w-0` on `DialogContent`.** It zeroes each grid item's
  min-width on mobile, so the track stays at the dialog width and children scroll
  inside their own overflow container.
- **The `max-sm:` scope is load-bearing, not tidiness.** An unscoped `min-w-0` on
  the children fixes phones but silently SHRINKS content-driven dialogs at
  tablet/desktop, because the dialog is `sm:w-auto` (shrink-to-fit) and the grid
  item's min-width currently props that width up. Measured with identical
  content: a `max-w-2xl` dialog goes 574 → 320px at 640px, 574 → 384 at 768,
  574 → 512 at 1024. Scoped to `max-sm`, `sm+` widths are byte-identical to
  before (574/574/574/720). Same trap applies to putting `grid-cols-1` on the
  dialog's content element.
- **`max-w-[calc(100vw-1rem)]` is not the mobile guard it appears to be.** A
  caller-supplied `max-w-sm`/`max-w-md`/`max-w-lg` is emitted LATER in the
  Tailwind 4 stylesheet, so at equal specificity it overrides the clamp (verified:
  base 359px, with `max-w-sm` 384px → element width reaches 375 vs a 375
  viewport). `max-w-2xl`/`max-w-3xl` are emitted earlier and do not override.
  When adding a dialog that must clamp on mobile, re-measure rather than trusting
  the base class.
- Admin Submissions **Completed** rows lacked the responsive pattern the
  **Pending** rows already had: at 375px a completed row overflowed itself
  (`scrollWidth 362 > clientWidth 349`) and pushed its actions outside the row.
  Both now share `flex min-w-0 … gap-3 p-3 sm:p-4` + `min-w-0 flex-1` +
  `truncate` + `flex shrink-0`.
- **Verification method that found these** (worth reusing): build once, then load
  the real emitted stylesheet in headless Chromium with class strings EXTRACTED
  from source (not hand-copied, so they cannot drift), and measure
  `getBoundingClientRect` of the dialog / tab strip / rows across 360–1440px.
  `PW_EXECUTABLE_PATH=/usr/bin/chromium` works with the repo's Playwright; there
  is no `.env` or injected session in this environment, so this static-DOM
  approach is the only way to observe layout (the authenticated admin page cannot
  be loaded, so the existing session-injection e2e specs all skip).
- Guards: `dialogContent.contract.test.ts` asserts (a) every declared
  `forwardRef` component is exported and (b) the mobile grid-item rule is present
  and `max-sm`-scoped. Assert on **the base class literal**, not the whole file —
  a naive `source.toContain(...)` is vacuous because the explanatory comment also
  names the utility (this bit the first version of the guard). Verified
  non-vacuous by reintroducing each defect.

## Admin Overview: no Recent Activity (2026-09-29)
- The Admin Overview is the **Command Center** (`/admin` →
  `src/pages/admin/AdminCommandCenter.tsx`). Its "Recent Activity" card was
  removed there only (commit `a54badca`): the card, its `ActivityEntry`
  interface, its `activity_log` select (`.limit(10)`), its `activityError`
  flag, its `activity` state, its `formatTime` use site and its
  `useRealtimeSubscription('activity_log', …)` are all gone. The remaining
  sections are KPI tiles → Cash Collection → Action queues; nothing was left
  behind (no empty container, gap, or placeholder).
- **The feature was NOT deleted globally.** The Live Activity Feed is its own
  page, `src/pages/admin/AdminActivityPage.tsx` (`/admin/activity`,
  `src/routes/admin.activity.tsx`), still linked from the admin sidebar
  (`nav.activity` in `DashboardLayout.tsx`) and the mobile "More" sheet
  (`MobileBottomNav.tsx`). It still does `.from('activity_log')` +
  `useRealtimeSubscription('activity_log', …)` with its own pagination
  (PAGE_SIZE 50, load-more), search filter and entity colour map — unchanged.
- **There is no shared Overview/Settings activity component** and Admin Settings
  never had a Recent Activity section. The Settings page only touches
  `activity_log` as a *data-reset category* (`RESET_CATEGORIES`, id
  `activity`, tables `["activity_log"]`) — that is deliberate and must stay.
  The orphaned `admin.commandCenter.{recentActivity,noActivity,activityLoadError}`
  locale keys remain in en/ar/he (the `i18nKeys.test.ts` parity guard only
  flags MISSING keys, not orphans) — leaving them is non-breaking; the
  `admin.activity.*` keys (`title`/`search`/`noActivity`) are still live.
- **Guarded** by `src/lib/adminOverviewActivityGuard.test.ts` (5 source-scan
  cases, quote-agnostic so a formatting-only change can't fail the suite) plus
  render coverage on both sides:
  `src/pages/admin/__tests__/AdminCommandCenterCash.test.tsx` (the Overview
  never queries or subscribes to `activity_log`, and shows no leftover
  placeholder) and `src/pages/admin/__tests__/AdminActivityPage.test.tsx`
  (the Activity page actually reads `activity_log`, renders the returned
  entries, subscribes to it, and shows its empty state). The render test is
  the behavioural half the string scan alone cannot prove — a page can keep
  the strings and stop fetching. All three verified non-vacuous: reintroducing
  the Overview card fails 3 assertions, and pointing the Activity page at the
  wrong table or dropping its `activity_log` subscription fails the render /
  source checks respectively.
- Verification (this repo, with `bun install --frozen-lockfile`): `npx tsc
  --noEmit` clean; `npx vitest run` 1685 passed | 1 skipped (107 files);
  `npm run build` clean. `npx eslint .` remains red with ~35k **pre-existing**
  repo-wide errors (`continue-on-error: true` in CI); the removal actually
  *reduced* `AdminCommandCenter.tsx` from 184 → 167 errors (the remaining ones
  are pre-existing prettier formatting + `no-explicit-any`). Never run
  `eslint --fix` on that file in an unrelated PR.

## Admin Command Center: failed background refetches must never erase real data (2026-09-29)

- **Symptom**: after any case action (confirm payment, mark as enrolled, update a
  case) the realtime `cases` subscription fires `fetchAll()`. If that refetch's
  `cases` read failed, the dashboard showed `Active Cases: 0 / Submitted: 0 /
  Enrolled: 0 / SLA Breaches: 0` while Forgotten Cases (an RLS-bypassing RPC)
  still showed the correct value — and only a full app relaunch restored the
  numbers.
- **Root cause (frontend)**: `fetchAll()` used a `val()` helper that mapped a
  failed query to `[]`:
  `r.status === 'fulfilled' && !r.value.error ? (r.value.data ?? []) : []`.
  A PostgREST failure resolves (it does not reject) with `{ data: null, error }`,
  so the failure was converted into a *successful read of an empty table*.
  `fetchAll()` therefore returned `counts: { total: 0, ... }`, and React Query
  **replaced its last known-good cache** with those fabricated zeros — the query
  itself never entered an error state, so nothing signalled a problem.
  **Rule: never launder a query error into an empty array. An empty result and a
  failed read are different states and must stay distinguishable.**
- **Fix** (`src/pages/admin/AdminCommandCenter.tsx`): `unwrap()` THROWS on
  `rejected` / `value.error` instead of returning `[]`. The KPI pair (`cases` +
  `get_forgotten_cases`) is **all-or-nothing** — `fetchAll()` aborts so React
  Query keeps the previous `data` and sets `status: 'error'`. Verified against
  `@tanstack/react-query` v5.103.1: on a failed refetch `data` is retained,
  `isError` becomes true, and the configured retry runs.
- **The four action queues** (`awaitingReview` / `unassigned` / `authFailures` /
  `attributionIssues`) are per-queue instead: a failing queue yields `rows: null`
  (not `[]`) plus `queueErrors[key] = true`, and the component carries forward the
  last known-good rows from a ref. `null` = "could not read"; `[]` = "read
  successfully, genuinely empty". **Read `lastGood.current` BEFORE assigning
  `lastGood.current = data`** — advancing the ref first makes the fallback
  resolve to the very snapshot whose queue is `null` (a real bug caught by the
  test, not by review).
- **UI**: a first-load failure (`isError && data === undefined`) renders
  `ErrorState` + Retry INSTEAD of the KPI wall, so fabricated zeros are never
  presented as real numbers. A background failure (`isError && data !== undefined`)
  keeps the real numbers and adds a dismissable-by-retry banner
  (`admin.commandCenter.refreshFailed`). The Refresh button disables and spins
  while `isFetching`.
- **Do NOT** "fix" this by removing the realtime subscription, raising
  `staleTime`, adding delays, auto-reloading the app, hardcoding defaults, or
  catching the error and returning empty arrays. The subscription is correct —
  it is the refetch that had to become resilient. No query/retry config was added
  locally; `src/router.tsx`'s global default (3 attempts, permanent errors never
  retried) already covers transient Supabase failures.
- **Root cause of the underlying transient `cases` failure: NOT conclusively
  proven, and deliberately not guessed at.** What was checked and ruled out as
  *not* the laundering mechanism: the query is a single-table `SELECT` with no
  joins/subqueries, so RLS evaluation does not recurse; the migration files are
  all committed and the live DB must already match HEAD (Forgotten Cases works
  through an RPC that queries `cases`, and a missing column would break every
  read, not intermittently); `cases` has `status`/`created_at`/`office_id`/
  `archived` indexes, so the unbounded KPI read is not obviously a timeout; and
  the realtime path does not cancel in-flight HTTP requests. The remaining
  plausible causes are the ordinary ones — a transient network/PostgREST error,
  a short-lived connection-pool or auth-token-refresh hiccup during a background
  refetch, or a statement timeout on the unbounded `cases` read as the table
  grows. **The fix is deliberately agnostic to which one it is**: a failed read
  now surfaces as a failed read and preserves the last good data, so the user
  never sees a false zero and never has to relaunch. If it recurs, capture the
  actual error object from the network tab / `unwrap()` throw site.
- Tests: `src/pages/admin/__tests__/AdminCommandCenterResilience.test.tsx` (9
  cases) drives the REAL `QueryClient` against a mocked Supabase boundary —
  background KPI failure keeps the previous values + shows the banner, retry
  recovers fresh values, first-load failure shows ErrorState (not zeros) and
  recovers via Retry, a failed queue reuses its last good rows, retained rows
  survive a later unrelated re-render, retained rows are labelled stale, and a
  genuine empty queue still renders empty. Every guard was verified
  non-vacuous by reintroducing the defect.
- **Review catch — the whole-snapshot ref was not enough (P1).** Keeping the
  last good rows in ONE `useRef<CommandCenterSnapshot>` only survived the
  single render right after the failure: the FAILED snapshot is itself what
  React Query caches, so the ref got overwritten with `null` for that queue and
  the rows vanished on the next unrelated render. The fix stores rows
  **per queue** (`useRef<Record<string, QueueRow[]>>`, written only when the
  value is truthy so a successful `[]` clears the queue).
  `queueErrors` is now derived from the snapshot (`data?.[key] === null`)
  rather than from the rendered rows, because after carry-forward the rendered
  rows are non-empty and `rows.length === 0` is false.
- **Review catch — retained rows looked current (P2).** With carry-forward the
  queue-level error was unreachable (`rows.length === 0` is false) and the
  global banner only covers a whole-query failure, so stale action/auth rows
  rendered with no notice. Retained rows now render an inline
  `admin.commandCenter.queueStale` alert above the list.
- **Vacuous-test trap (worth remembering).** The first version of the
  re-render guard used a realtime callback and PASSED against the buggy code.
  React Query's **structural sharing** keeps the same reference when refetched
  data is deeply equal, so refetching the same `[]` produced NO re-render to
  lose the rows. The test now forces a genuine re-render via a real
  cash-query data change (and asserts the cash row appears, proving the render
  happened). Re-run against the reverted logic it fails — so the guard is
  real. A test that "passes" without a render is not testing the render path.
- **Test-mock gotcha (this broke an existing test and is worth remembering)**:
  `supabase.rpc()` returns a thenable **PostgrestFilterBuilder**, not a Promise.
  `AdminCommandCenterCash.test.tsx` stubbed it with `Promise.resolve(...)`, so
  `supabase.rpc(...).limit(6)` threw a synchronous `TypeError` and EVERY query
  failed — invisible before, because the old `val()` swallowed it into zeros and
  the cash card still rendered. With the throw-instead-of-swallow fix the same
  stub surfaced as a genuine "Unable to load" and failed 3 tests. **Any test
  mocking `supabase.rpc` must return a chainable-thenable stub, not a bare
  Promise** (see the `rpcChain` helper in both admin test files).
- Build/test: `npx tsc --noEmit` clean; `npx vitest run` 1697 passed | 1 skipped;
  `npm run build` clean. Lint: the component carries pre-existing
  `prettier/prettier` debt (169 errors at HEAD — the whole file is single-quoted
  while the repo config wants double quotes); a full `prettier --write` would
  churn 607 insertions/301 deletions, so the change deliberately MATCHES the
  file's local style rather than reformatting it. The new test file is
  eslint-clean.

## Student Dashboard mobile card width / overflow (2026-09-30)
- The Student Overview quick actions live in `src/components/student/StudentOverviewSection.tsx`, rendered by `StudentNextStepsPage` at the `/student/` route (`src/routes/student.index.tsx`). `/student-dashboard` is a SEPARATE route that only redirects to `/student/checklist` (`ChecklistTracker`), so it is not this surface.
- The Quick Actions grid was `grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3`, so below `sm` (< 640px) three narrow cards were forced across the phone. Fixed to `grid grid-cols-1 gap-2 sm:grid-cols-5 lg:grid-cols-3`: 1 column on phones, 5 at `sm`, 3 at `lg` (unchanged desktop). Each action button gained `w-full min-w-0` and each label `min-w-0 max-w-full break-words` so a translated label cannot establish an intrinsic width wider than its grid track.
- The overview's `lg:grid-cols-2` two-column desktop split was correct and was NOT changed. **Update (see the follow-up section below):** the overview later gained an explicit `grid-cols-1` base plus `min-w-0` on its columns, because a base-less grid creates an implicit `auto` track that a `truncate` label can inflate past the viewport. Do not remove that base `grid-cols-1`. The WhatsApp `flex flex-wrap gap-2` row already wraps safely inside the card and was left unchanged (no `overflow-x-auto`, no fixed widths, no global CSS hacks).
- Guarded by `src/lib/studentOverviewResponsiveGuard.test.ts` (6 source-scan cases; verified non-vacuous — reintroducing the buggy classes fails 4 of them).
- Verified with the real built stylesheet in headless Chromium at 320/360/375/390/430/768/1024/1280 in en + ar (RTL): quick-action track counts 1/1/1/1/1/5/3/3, every card inside its grid track, and no horizontal overflow on `documentElement` or `<main>`.
- Build/test: `npx tsc --noEmit` clean; `npx vitest run` 1703 passed | 1 skipped; `npm run build` clean.

## Student Dashboard language-dependent overflow — implicit `auto` grid track (2026-09-30)
- Follow-up report after the quick-actions fix: switching to **English or Hebrew**
  also overflowed the Student Dashboard, while Arabic did not. Reproduced on the
  real page (built stylesheet + mocked Supabase REST/auth in headless Chromium).
- **Root cause is the implicit grid track, not the quick actions.** The overview
  was `grid gap-4 lg:grid-cols-2` with NO unprefixed `grid-cols-*`. A grid with no
  explicit column count creates a single implicit track of `auto`, which sizes to
  the widest item's **min-content**. The important-contacts card renders contact
  names with `truncate` (= `white-space: nowrap`), so its min-content is the full
  unwrapped name. `"KAPITO Sprachschule International Office"` propped the track
  to **387px inside a 288px box — a 99px overflow at 320px** (59 at 360, 44 at
  375, 29 at 390). The Arabic name is shorter, so it fit and the bug looked
  language-dependent. A grid item's default `min-width: auto` means the item
  cannot shrink below that min-content, so `overflow-x-hidden` on the shell
  silently CLIPPED the cards instead of scrolling.
- Fix (both in `StudentOverviewSection.tsx`): explicit `grid grid-cols-1 gap-4
  lg:grid-cols-2` so the mobile track is `1fr` (not `auto`), plus `min-w-0` on
  each overview column and on the truncating contact row so they shrink to the
  track instead of contributing their min-content. `min-w-0` alone also fixes it;
  both are applied for defense-in-depth.
- `ChecklistTracker.tsx` (the `/student-dashboard` → `/student/checklist` target)
  had the same class of bug: `flex items-center gap-6` with a fixed `w-24` ring,
  where the text column had no `min-w-0`, so the single translated progress
  sentence clipped 32px at 320px in en/he and 0 in ar. Fixed with `min-w-0` on the
  text column, `shrink-0` on the ring, and a wrapping `min-w-0 break-words` title.
- **Do NOT "fix" this by relying on the shell's `overflow-x-hidden`** — it hides
  the symptom by clipping content. The track/item shrink allowance is the fix.
  Same trap applies to any new grid written without a base `grid-cols-*` that
  contains `truncate` text. (`StudentContactsPage` and `StudentDataPage` use
  `grid gap-3` / `grid gap-4 sm:grid-cols-2` with no truncate text — measured
  clean, left unchanged.)
- Guarded by `src/lib/checklistTrackerResponsiveGuard.test.ts` (4 cases) and
  extended `src/lib/studentOverviewResponsiveGuard.test.ts` (the old assertion
  that the overview had NO base `grid-cols-*` encoded the bug and was replaced).
  Both verified non-vacuous: reverting the classes fails 5 of the 13 cases.
- Verified on the real page at 320/360/375/390/430/768/1024/1280 in en/ar/he:
  mobile quick actions 1 column at full width, `sm` 5 columns / 1 row, `lg`
  2-column overview + 3-column quick actions, no page or `<main>` horizontal
  overflow in any locale.
- Known remaining (NOT language-dependent, left unchanged): the `DashboardLayout`
  header's language-switcher row clips ~25px at 320px **equally in en/ar/he**
  (it scrolls horizontally by design). `DashboardLayout` is out of scope for this
  fix; it is not the reported regression.
- Build/test: `npx tsc --noEmit` clean; `npx vitest run` 1710 passed | 1 skipped;
  `npm run build` clean. Changed files carry identical eslint counts to baseline.

## Student dashboard: emergency call card + chat box back arrow (2026-09-30)

Two student-facing fixes on top of PR #136 (the mobile/language overflow fix).

### Emergency numbers are `tel:` links, never chat buttons
- `src/components/student/EmergencyCallCard.tsx` is the ONE source of the three
  fixed numbers (`EMERGENCY_NUMBERS`: police **110**, ambulance **112**, fire
  **112**) — deliberately NOT sourced from `important_contacts` or
  `contactConfig` (those are DARB staff/partner contacts, not emergency
  services). Each entry renders an `<a href="tel:...">`, so a tap opens the
  native dialer. Do not turn these into `onClick`/chat handlers.
- Rendered **full width** in `StudentOverviewSection.tsx` between the Quick
  Actions card and the Tools card — NOT as a 1/3-width Quick Action tile, so the
  numbers stay readable in a crisis.
- The same component exports `EmergencyNumberButtons` (compact, label-less,
  `aria-label` + `title`) for the chat box header, where horizontal room is
  scarce. Same `tel:` handoff. One number list, two presentations.
- Grid: `grid grid-cols-1 gap-2 sm:grid-cols-3`, each link `w-full min-w-0` with
  a `truncate` label, so a long translated label cannot widen its grid track.
- i18n: `student.overview.emergency`, `.emergencyHint`, `.emergency_police`,
  `.emergency_ambulance`, `.emergency_fire` in en + ar + he. The component keeps
  a `FALLBACK_LABEL` map (Police/Ambulance/Fire brigade) so a missing dictionary
  never renders a raw key like `fire`.

### Student messages: conversation list ↔ chat box with a back arrow
- `src/pages/messages/StudentMessagesPage.tsx` is a list-first inbox: the
  conversation list (`ThreadList`) is the default view, and opening a thread
  swaps in the chat box. The chat-box header owns the back arrow
  (`aria-label` `chat.backToChats`, `backToList` → `setOpen(null)`), which
  restores the list — this is what lets a student return to all conversations
  instead of being stuck in one thread.
- The back icon flips for RTL (`const BackIcon = isRtl ? ArrowRight : ArrowLeft`)
  rather than hardcoding a physical side.
- The chat-box header also renders `EmergencyNumberButtons`, so the emergency
  numbers stay one tap away mid-conversation.
- The Quick Actions "Messages" tile points at `/student/messages`
  (`nav.messages`, `MessageSquare`) — it used to duplicate Contacts.
- i18n: `chat.backToChats` + `messagesInbox.startTeamChat` /
  `.caseConversationHint` / `.payoutConversationHint` / `.teamConversationHint`
  in en + ar + he.
- `backToList` is UI-only; every thread still goes through the existing
  `CaseMessageService` / `DirectMessageService` RPCs. No backend change.

### Guards + verification
- `src/lib/studentEmergencyAndChatNavGuard.test.ts` (source scan): emergency
  numbers use `tel:` and are NOT chat handlers, the emergency card renders
  full-width in the overview, the chat box has a working back arrow, the icon
  flips in RTL, and `EmergencyNumberButtons` is wired into the chat header.
  Verified non-vacuous (reverting `tel:` → `#`, the back handler, or the tile
  href fails 6 tests).
- Render tests: `src/components/student/__tests__/EmergencyCallCard.test.tsx`
  (both presentations, tel: hrefs, aria labels) and
  `src/pages/messages/__tests__/StudentMessagesPage.test.tsx` (list → chat box →
  back, emergency links present in-chat, RTL back arrow).

### Student inbox: real activity, existing team thread, resolved header name
- The conversation list is built from `listMyDirectThreads()` (the same service
  the staff inbox uses), not from hardcoded placeholders. `loadDirectThreads()`
  resolves, in one call: the **existing** team thread (matched by
  `otherUserRole === "team_member"` — this is why `get_staff_directory` must be
  mocked in tests, otherwise the role is null and the thread is invisible), the
  advisor's display name, and each thread's `lastMessage` / `lastMessageAt` /
  `unread`.
- Previously every row had `preview: ""`, `timestamp: null`, `unread: 0`, and the
  team row only existed after pressing "Message my team member" — so an existing
  advisor conversation was hidden and a returning student saw no unread badge.
- `timestamp` is passed **raw** (`thread.lastMessageAt`); `ThreadList` formats it
  itself via `formatThreadTime`. Passing an already-formatted value caused a
  double-format that rendered empty.
- `previewFor()` handles text, voice notes (`chat.voice.message`) and other
  attachments (`chat.attach.only`) — an attachment-only message no longer reads
  "No messages yet".
- The back arrow refreshes the threads (`backToList` → `setOpen(null)` +
  `loadDirectThreads()`), so badges/previews are not stale after reading a chat.
- The open chat header renders the resolved name for the team tab, so it cannot
  disagree with the list row.
- New locale key `messagesInbox.openConversation` (en/ar/he) is the case row's
  preview; `t()` calls here keep inline English fallbacks like the rest of the
  file.
- **Mock gotcha (recurring)**: `StudentMessagesPage.test.tsx` must mock
  `@/integrations/supabase/client` with an `auth.onAuthStateChange` surface —
  `DirectMessageService` subscribes at module scope, so a bare `{ supabase: {} }`
  mock fails the whole file at import before any test runs.
- Responsive verification is static (no session): the harness loads the REAL
  emitted `styles-*.css` with class strings EXTRACTED from source, at
  320/360/375/390/430/768/1024/1280 in LTR **and** RTL. Confirmed
  `scrollWidth <= clientWidth` for the document, `<main>`, and the chat header;
  Quick Actions are 1/row <640px, 5/row 640–1023, 3/row ≥1024. Before/after on
  the old `grid-cols-3`: 3 cards/row at 74–97px wide → now 1 card/row at
  238–308px.

### Pre-existing main-branch breakage (fixed here so CI can pass)
- `origin/main` failed `npx tsc --noEmit` in `src/components/student/StudentCityGuide.tsx`
  (4 errors) and `src/routes/student.city-guide.tsx` (1 error), and the i18n
  guard was red because `student.cityGuide.schoolCityDescription` was used in
  source but missing from en/ar/he. Both were pre-existing and unrelated to the
  student messaging work; the locale key and the City Guide type errors are now
  fixed.
- **The `src/routeTree.gen.ts` "revert build churn" advice is WRONG for this
  repo — do not follow it.** The CI `quality` job runs **Typecheck BEFORE
  Build**, and `npm run build` is `vite build` only (it never typechecks). On
  `origin/main` the committed route tree was stale: it carried
  `/student/city-guide` in the route unions but **not** in `FileRoutesByPath`,
  because the generator only rewrites a route when it is missing from
  `routeTree`. With that stale file, `createFileRoute("/student/city-guide")`
  fails TS2345 and the quality job can never pass. Regenerating the tree from
  scratch (`rm src/routeTree.gen.ts && npm run build`) fixes it; the regenerated
  file **must be committed**. Verified both ways: stale tree → TS2345, committed
  regenerated tree → clean `tsc`, and `tsc` stays clean after a subsequent build.
- `StudentCityGuide.tsx` type fixes (no behaviour change): `visibleCategories`
  is annotated `StudentCityGuideCategory[]` (the `variant === "preview" ? A : B`
  ternary widened to `string[]`, which broke indexing `CATEGORY_ICONS`,
  `setSelectedCategory` and `categoryLabel`), and `categoryLabel` takes
  `TFunction<"dashboard">` instead of a hand-written
  `(key: string, fallback?: string) => string` signature.

## Main CI repair + #143 review follow-ups (2026-09-30)

Two consecutive merges (#142, #143) each left `main` red. Both were repaired by
fast-forward pushes to `main` (no force-push), because the PRs were already
merged and the fixes were small and isolated.

### `npm run typecheck` exit code — capture it correctly
- `npx tsc --noEmit 2>&1 | head -5; echo $?` reports the exit status of `head`,
  **not** `tsc`. That silently produced a "typecheck=0" on a tree that was
  actually failing. Write to a file and check separately:
  `npx tsc --noEmit > /tmp/tsc.out 2>&1; echo "tsc exit=$?"`.
  `vitest` passing and a misread `$?` are both non-gates.

### Vitest `toHaveBeenCalledWith` compares arity strictly
- A mock declared `vi.fn((name: string, args?: unknown) => …)` **records two
  arguments** when the integration wrapper forwards `mockRpc(name, args)` and
  the caller passes only one. The recorded call is `(name, undefined)`, so
  `expect(mockRpc).toHaveBeenCalledWith("name")` **fails** — a trailing
  `undefined` is not tolerated.
- Assert on the first argument instead:
  `mockRpc.mock.calls.some(([name]) => name === "…")`. This bit the new
  team-thread test in #143, which could never pass and was merged red.

### Duplicate object keys are a real failure (TS1117), and CI step order hides them
- `MobileBottomNav.tsx` `shortLabel` had `'nav.account'` twice → `TS1117`.
- `.github/workflows/ci.yml` `quality` runs **Lint → Unit tests → Typecheck →
  Build**. A failing unit-test step aborts the job, so the typecheck never ran
  and the duplicate key was invisible. When a PR's quality job fails, fix the
  FIRST failing step and re-run — later steps may hold additional errors that
  were never reached.
- When touching a large keyed literal, check for duplicates:
  `sed -n '/const shortLabel/,/^  };/p' FILE | grep -oE "'[^']+':" | sort | uniq -d`

### `nav.*` is pinned to the `dashboard` namespace
- Components read nav labels via `useTranslation("dashboard")` with **no
  `fallbackNS`**, so a key that exists only in `common` resolves to the inline
  English fallback. `nav.home` was missing from the `dashboard` dictionaries for
  exactly this reason (added to en/ar/he).
- `i18nKeys.test.ts` accepts a key found in ANY namespace the file touches, so
  it stayed green. It now has a `has every nav.* key in the dashboard
  dictionaries` case pinning `nav.*` to `dashboard` (verified non-vacuous).

### Guard irreversible actions at the RPC, not just the UI
- `start_student_team_member_thread` does check-then-insert on
  `direct_threads`/`direct_thread_participants` with **no lock and no unique
  constraint**, so concurrent callers each create their own thread.
  `teamThreadLoading` state is async, so two taps in the same tick both read
  `false` → measured **3 taps = 3 RPC calls**.
- Fixed in both layers: a **synchronous ref guard** on the client (drops the
  second tap before it fires) plus a **transaction-scoped advisory lock** on the
  (student, advisor) pair in migration `20260930150000` (MANUAL DEPLOY), so the
  function is idempotent for ANY caller. Mirrors the `pg_advisory_xact_lock`
  pattern in `20260928120000_voice_call_rpcs.sql`. Also REVOKEs the RPC from anon.
- Regression test added; with the guard removed it observes 3 calls from 3 taps.

### Merged-red PRs leave unresolved review threads
- Both #142 and #143 merged with `resolved=false` review threads (Greptile P1/P2,
  Aikido Medium). After repairing `main`, reply to each thread with the fixing
  SHA and resolve it — a merged PR keeps its threads open forever otherwise.
- `gh pr checks <n>` on a merged PR still reports the failing `quality` job, and
  the run for its head SHA shows the same failure — useful for proving a defect
  was pre-existing rather than introduced by your push.

### Verification
- `npx tsc --noEmit` clean; `npx vitest run` 1748 passed | 1 skipped;
  `npm run build` clean; main CI `quality` success at `65f23091`.
- PRs #142/#143: MERGED, 0 unresolved threads. No open PRs.


## PR #148 CI repair — Refer & Register (`feat/student-refer-register-master-flow`, 2026-09-30)

PR #148 ("rebuild Refer into direct registration workflow") was pushed with a
`quality` job that failed on all three gates at once. The branch had never been
typechecked locally, so these defects were invisible until CI ran. Fixed at
`b54aa07`.

### Module-level parse errors masquerade as many type errors
- `ReferralRegistrationFlow.tsx:555` had a concise arrow body containing TWO
  statements: `onClick={() => update(...); update(...)}`. The `;` after the
  first call makes the arrow body end, so `update(...)` became a second
  top-level expression — **a parse error for the whole module**, not one bad
  line. `tsc` reported 14 diagnostics (TS1005/TS1128/TS1381/TS1382) spread over
  the file plus phantom TS2304 "Cannot find name" for symbols that WERE
  imported, because a failed parse discards the module's scope.
- **Rule: when a single file yields a cluster of unrelated syntax + "Cannot find
  name" errors, look for ONE parse error near the first diagnostic.** A dozen
  errors in a file you barely touched is a parse failure, not a dozen bugs. The
  fix is a block body: `() => { a(); b(); }`.
- Same class bit `useLang` narrowing: `lang === "ar" || lang === "he"` was
  TS2367 (no overlap) because `useLang(): "en" | "ar"`. Widening `useLang` to
  include `"he"` was the WRONG fix — it cascaded ~40 TS2345 errors across
  `src/components/catalog/**` and `src/components/team/catalog/**`, which pass
  `useLang()` into helpers typed `"ar" | "en"`. The right fix was local: derive
  `isRtl` from `i18n.language` inside the component. **Check the blast radius of
  a signature change before widening a shared hook.**

### Missing imports are three distinct symptoms
- `AdminCommandCenter.tsx` used `useEffect` without importing it → CI `Unit
  tests` failed with a `ReferenceError` at render (vitest), not a type error.
- `StudentReferPage.tsx` never imported `useTranslation` → `tsc` TS2304.
- `AdminReferralOperationsPage.tsx` referenced `lang`, which was never declared
  → TS2304. Replaced with `i18n.language.startsWith("ar")`, matching the pattern
  used elsewhere on that page.

### i18n guards: key existence AND value translation AND correct nesting
- `i18nKeys.test.ts` failed on `referralRegistration.insurance.none` (4 entries:
  ar+en x 2 call sites). Adding it initially nested it under
  `referralRegistration.history.insurance.none` — **the guard resolves the
  literal key path, so a key added one level too deep still reads as missing.**
  Confirm the exact dotted path the `t()` call uses before inserting.
- `hebrewLocaleCoverage.test.ts` failed because the new Hebrew block copied
  English: `referralRegistration.eyebrow` was `"DARB"` in `he`. Per the
  value-level guard (English != Arabic AND Arabic contains Arabic script ⇒ must
  be translated), the brand must be transliterated: `דארב`, matching the
  existing `he` convention (`nav.darb`, `pushSettings.darb`). **The brand IS
  translatable — do not add `eyebrow`/`brand` to `IDENTICAL_BY_DESIGN`.**
- Locale edits stayed insertion-only (3–5 line diffs per file) — no re-sorting
  of the surrounding block.

### Verification (this repo)
- `npx tsc --noEmit` clean; `npx vitest run` 1767 passed | 1 skipped (119 files);
  `npm run build` clean (nitro `.output/` build, 3.80s).
- CI `quality` on `b54aa07`: Lint / Unit tests / Typecheck / Build / Lovable
  binding all **success**. CodeQL, OpenCodeReview `code-review`, Aikido (both
  checks) pass. `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`, 0 unresolved
  review threads.
- **Greptile was temporarily out of trial credits** and posted only
  "has reached the 50-credit limit" bodies, so the first pass recorded that as
  "not actionable — do not chase it". **That was wrong and it cost a round
  trip**: the credits refreshed on the next push and Greptile then delivered 13
  substantive findings, all of which were real (see the section below). A credit
  notice is a *deferral*, not a clean review — re-poll the threads after the next
  push instead of recording the PR as review-complete.
- Aikido's three inline findings (High: repeated card checkout; Medium x2:
  public bank-transfer reopen / submitted-mark blocks card) were already
  resolved in the PR, and were verified present in CODE, not just marked
  resolved: `create_registration_card_payment_internal` is `FOR UPDATE` +
  idempotent (reuses a `pending` card payment; returns `paid:true` early when
  `payment_status='paid'` or a confirmed payment exists), the edge function
  sends a stable Stripe `Idempotency-Key`
  (`darb-registration-checkout-<payment.id>`), and
  `submit_registration_bank_transfer` refuses once `payment_status='paid'`.
- The migration `20261001090000_student_referral_registration.sql` is MANUAL
  DEPLOY (not applied by the Vercel build or `ci.yml`).

## Direct student registration — Greptile re-run on PR #148 (2026-09-30)

Greptile's credits refreshed after the docs push and it re-reviewed the PR with
13 findings. All 13 were **real**; every one failed *silently* — which is why the
original pass shipped them. Verified against the code, fixed in `9a079ef`, and
each now has a guard in `src/lib/referralRegistrationGuards.test.ts` (10 cases,
verified non-vacuous by reintroducing the defect).

- **`AS $` / `$;` is not a dollar quote.** Two function bodies used it, so
  Postgres rejected the whole migration file — no table and no function was ever
  created. Restored to `AS $$` / `$$;`.
- **Regex literals were double-escaped** (`'^\\d{4}-\\d{2}$'`). Under
  `standard_conforming_strings=on` that is a literal backslash + `d`, so the
  start-month, email and phone patterns matched nothing real and every
  submission was rejected as invalid. The repo's convention is single-backslash
  (`'^[^[:space:]@]+@[^[:space:]@]+$'`); match it.
- **`case_reference` is on `cases`, not `case_registration_invoices`.** Both
  payment RPCs selected `v_invoice.case_reference`, so starting a card payment or
  marking a bank transfer raised immediately. Now
  `SELECT i.*, c.case_reference ... JOIN public.cases c ON c.id = i.case_id
  ... FOR UPDATE OF i` (row lock must name `i` once a join is present).
- **The same column mistake in a JS select** (`AdminCommandCenter` referral
  queue). PostgREST errors, the catch empties the queue, and an empty queue looks
  exactly like "nothing to do". Join as `cases(case_reference)`.
- **`insurances.billing_period` was ignored** in the server total, so a `one_time`
  premium was multiplied by the program months — the invoice charged more than
  the quote the student approved. Mirrors `insurancePricing.ts` and the canonical
  `case_submissions` calculation: multiply only when `billing_period='monthly'`.
- **The `'none'` insurance sentinel was cast to uuid** and blew up registration.
  Resolve it as `NULLIF(NULLIF(p_data->>'insurance_id',''),'none')::uuid`.
- **A trigger blocked the whole flow.** `enforce_case_stage_transition`
  (20260818090000) allows `new -> contacted` only, so the confirm RPCs'
  `new -> profile_completion` raised `STAGE_BLOCKED` and rolled the payment
  confirmation back. The trigger is redefined in this migration with that one
  added edge — and, per the follow-up review, gated on the case actually being a
  `student_referral_registration` **with a paid invoice**, plus admin-or-assigned
  staff. Without that second condition any staff member could push *any* case
  past `contacted`/`appointment_scheduled` and skip its appointment outcomes.
  The timestamp must stay newer than 20260818090000, or an out-of-order re-run of
  the older file drops the exception again.
- **`programs` / `accommodations` SELECT policies cover `team_member` and
  `admin` only**, so a student could pick a school but never load its courses or
  housing — the whole flow was unreachable. Rather than widening RLS, added the
  `SECURITY DEFINER` `get_registration_catalog(p_school_id)` RPC (one school,
  active rows, explicit column list, no wildcard) and the flow calls it. This is
  the same RPC-first pattern as `get_student_important_contacts`.
- **History query omitted `public_token`**, so invoice links resolved to
  `/invoice/undefined`.
- **`InvoicePage` had lost the confirmed-payment and remaining rows** (the PDF
  kept them), so a partially paid invoice hid what was still owed.
- **`registrationInvoicePdf` had no space check** before the totals/memo/bank
  block: a few wrapping item names pushed them past the fixed footer at `y=282`.
  It now computes the block height and starts a new page.
- **Invoice resends reused one idempotency key** built from the invoice number
  alone, so the mail service deduplicated every resend while reporting success.
  Include a per-send value.
- **One-time insurance rendered as "1 month · €X/month"** even after the total was
  fixed — the *amount* was right but the label read as recurring. The item now
  carries `billing_period`, and one shared `formatInvoiceItemBilling`
  (`src/utils/invoicePresentation.ts`) renders it for the invoice page; the Deno
  email template mirrors it in `billingLine()` (it cannot import from `src/`) and
  `src/utils/invoiceItemBilling.test.ts` asserts the two copies' wording matches
  per locale, so the duplication cannot drift silently.

### Recurring lessons
- **A PostgREST/JS select naming a column that does not exist is a silent
  failure**, because the surrounding `catch` usually degrades to an empty state
  that is indistinguishable from a legitimate empty result. Check the column
  against the table, not against a sibling query.
- **A `FOR UPDATE` row lock must name a single table once the query is a join**;
  the bare form errors.
- **SQL string escaping**: this repo writes regexes with a single backslash
  inside standard single-quoted literals. Doubling them silently changes the
  pattern.
- **When a trigger is redefined to unblock a flow, scope the new edge to the
  flow's own rows.** "Who may do it" (admin/assigned staff) is not the same
  question as "which cases is it valid for".
- **Widening RLS is not the only option for a read a role lacks** — a scoped
  `SECURITY DEFINER` RPC keeps the policies untouched and returns only the rows
  and columns the caller legitimately needs.
- **Locale/format duplication across the `src` ↔ Deno boundary needs a drift
  guard**, not a comment. Assert the two copies agree on the values that matter.
- Verification: `npx tsc --noEmit` clean; `npx vitest run` 1790 passed | 1 skipped
  (122 files); `npm run build` clean.



## i18next runtime smoke test (2026-10-01)
- i18next was upgraded 23 -> 26 (PR #149). `src/lib/i18nRuntime.test.ts` initializes the REAL `src/i18n.ts` (fetch stubbed to serve `public/locales`) and checks bundled `common` in ar/en/he, interpolation, `t(key, "default")`, he -> en fallback, the HTTP `dashboard` namespace, and `dir`/`lang` on language change, because the key-coverage tests only read JSON and cannot catch a library loading regression.

## Office Google Business permission foundation (Phase 1, 2026-10-01)
- Migration `20261001160000_office_google_permission_foundation.sql` adds the
  DARB-side ownership layer *before* any Google API work: `office_google_profiles`
  (one per office, placeholder location), `office_google_operators`
  (PRIMARY/SIDE_MANAGER), `google_business_connections` (DARB-level, no tokens),
  and the append-only `google_business_activity` audit. No OAuth, no Google
  calls, no token storage.
- **The admin gate is `public.is_admin_session()` (admin role AND AAL2), never
  `has_role(...,'admin')`.** An AAL1 (password-only) admin session must not be
  able to change a primary or read Google rows; a regression test logs the admin
  in at AAL1 and asserts the write and the RLS read both fail.
- Office isolation is enforced twice: RLS `SELECT` policies and every write RPC.
  Tables are read-only to `authenticated` (no INSERT/UPDATE/DELETE grant) — all
  writes go through `SECURITY DEFINER` RPCs, so the same-office/active-member
  invariants and the append-only audit cannot be bypassed by a direct write.
- `authorize_google_office_action(p_user_id, p_office_id, p_action)` is the one
  permission source of truth. It refuses to answer for a `p_user_id` other than
  `auth.uid()` (no membership oracle), grants `service_role` a system bypass,
  and re-checks live membership so a stale operator row cannot grant access.
  `src/lib/googlePermissions.ts` mirrors it for UI affordances only.
- Invariants: at most one PRIMARY and one SIDE_MANAGER per office (partial unique
  indexes), operators must be active same-office members (trigger), a member
  cannot hold both roles at once (RPC rejects with a clear message), and a
  PRIMARY cannot appoint themselves as side manager.
- Verification: a plain-Postgres harness (`/tmp/phase1_harness.sql`,
  `/tmp/phase1_verify.sql`) reproduces the Supabase auth shims and asserts office
  isolation, the operator rules, direct-API/table attacks, RLS per role, the MFA
  gate, the authorizer oracle guard, and the audit trail — 71/71 passing.
- UI: `OfficeGoogleBusinessSection` is wired into `AdminOfficesPage`'s office
  dialog; the Connect control is intentionally disabled until Phase 2. The
  operator selector is fed only same-office active members.

## Office Google Business location mapping (Phase 3, 2026-10-01)
- Migration `20261001170000_office_google_location_mapping.sql` (newer timestamp
  than Phase 1, so its redefined `authorize_google_office_action` wins on a fresh
  deploy). Adds the admin-only `google_business_locations` cache, richer
  `office_google_profiles` columns, a `mapping_status` lifecycle
  (`UNMAPPED/PENDING_CONFIRMATION/MAPPED/DISCONNECTED/MAPPING_ERROR`), and the
  Phase 3 actions (`GOOGLE_DISCOVER_LOCATIONS/VIEW_LOCATION/MAP_LOCATION/
  REMAP_LOCATION/UNMAP_LOCATION`) — all admin-only in the authorizer.
- **A mapping rejection rolls back its own audit insert.** The failure-path
  `INSERT INTO google_business_activity` inside `admin_map_office_google_location`
  would roll back with the raised exception (dead code). The rejection audit
  therefore lives in its own RPC, `admin_record_google_mapping_attempt`, called
  by the server function *after* the authoritative RPC fails. It is constrained
  to the known rejection actions so it can never fabricate an arbitrary entry.
- Mapping is never automatic. `admin_map_office_google_location` locks the office
  row, then re-validates that the location exists in the cache, belongs to the
  named account, and is not already mapped to a different office; a forged
  `google_account_id` or `office_id` is rejected server-side. `UNIQUE
  (google_location_id)` from Phase 1 is the concurrency backstop.
- Discovery runs in admin-gated server code (`googleBusinessLocation.functions.ts`),
  files each location under the account it was verified from (never a
  client-supplied id), and upserts through `admin_sync_google_locations`. The
  `google_business_locations` table has **no grant to any browser role** — reads
  go through `admin_list_google_locations` / `get_office_google_mapping`, so
  `raw_location_json` is never reachable from the client. `get_office_google_mapping`
  is office-scoped for active members and admin-wide.
- `googleLocationMatch.ts` produces a *suggestion* only (labeled heuristic, never
  "verified"); the admin always confirms before the RPC runs.
- Verification: `/tmp/phase3_verify.sql` (45/45) covers idempotent re-sync,
  malformed-payload rejection, cross-office isolation on the read RPC, duplicate
  location, forged account, and rejection auditing; Phase 1 stays 71/71.
- Gotcha: `src/lib/arabicBrandSpelling.test.ts` rejects the Arabic misspelling
  `دارب` and any Latin `DARB` in `ar` locale values — use `درب` (this also fixed
  a Phase 2 `googleConnection.notLinked` leak).

## Office Google Business delegation (Phase 4, 2026-10-01)
- Migration `20261001180000_office_google_delegation.sql` adds the delegation
  surface on top of Phase 1/3: `list_my_google_offices()` (offices the caller
  operates), `list_office_google_operator_candidates(uuid)` (active same-office
  members, for the assignment selector), `assign_google_side_manager`,
  `remove_google_operator`, and the `notify_google_operator_event` trigger.
- **Operator assignment is RPC-only.** `office_google_operators` has no
  INSERT/UPDATE/DELETE grant to `authenticated`; only Admin (AAL2) or the office
  PRIMARY can assign/remove the side manager, and the candidate list is filtered
  server-side (`is_active_team_member` + `office_members.is_active`) so the UI
  never assembles the eligible set itself. `get_office_google_mapping` now also
  returns `primary_is_active` / `side_manager_is_active` for the "⚠ Inactive"
  warning.
- The `notify_google_operator_event` trigger notifies the *affected member* (never
  the actor) on assignment/removal, pointing at `/team/google`. Its
  `google_business` source buckets to the `system` notification category; the
  Phase 4 migration redefines `notification_category_for_source` and is newer
  than Phase 3, so it wins on a fresh deploy.
- **Test gotcha (fixed):** `notificationCategories.test.ts` read every
  `THEN '...'` literal in the newest producer migration file. Phase 4's file also
  contains a non-category `CASE ... THEN 'admin'` (the audit `actor_role`), which
  false-failed the catalog check. The test now slices out just the
  `notification_category_for_source` body before matching.
- **Hebrew brand keys:** `nav.googleBusiness` / `team.googleBusiness.title` use
  `דארב` (the translated brand), not the Latin `Google Business`, or
  `hebrewLocaleCoverage.test.ts` fails on the untranslated-English guard.
- Verification: `/tmp/phase4_verify.sql` (98/98) and
  `supabase/diagnostics/office_google_phase4_deploy_verify.sql` (50/50) cover the
  candidate list, operator-active flags, mapping RPC checks, grants, and
  role/session gates.
- UI: `TeamGoogleBusinessPage` (`/team/google`, nav `nav.googleBusiness`) lists
  only the caller's offices from `list_my_google_offices`; a PRIMARY gets the
  side-manager selector, a SIDE_MANAGER gets a read-only view. The admin
  `OfficeGoogleBusinessSection` now pulls candidates from the server RPC instead
  of receiving a client-filtered `eligibleMembers` prop.


## Office Google Business reviews (Phase 5, 2026-10-01)
- Migration `20261001190000_office_google_reviews.sql` adds the review cache and
  the first Google *write* path (reply/delete). `google_business_reviews` is
  unique on `(google_location_id, google_review_id)`, RLS inherits the office's
  rules, and no browser role holds INSERT/UPDATE/DELETE — writes are RPC-only.
- **Server-side filtering is the contract.** `list_office_google_reviews`
  (rating/status/search/sort/limit/offset + `total_count`) and
  `get_office_google_review_summary` do the work; the React page never filters or
  paginates a full list.
- **Sync is a reconciler, not a mirror.** `admin_sync_google_reviews` upserts and
  marks reviews Google no longer returns as `visibility_state = 'NOT_FOUND'`
  (never deletes). A sync that predates Google's reply propagation must not erase
  DARB's optimistic `REPLY_PENDING`, so that status survives the upsert.
- **Reply flow is confirm-before-commit.** `resolve_google_review_office` maps a
  DARB review id back to its office/location and rejects a cross-office id;
  `admin_apply_google_review_reply` only flips DARB status after Google confirms
  and enforces the 4096-byte limit. The gateway's `gbpDelete` deliberately does
  not retry (a second DELETE would target an already-gone reply); `gbpPut` retries
  5xx only.
- **Lock RPCs are authorized.** `acquire_google_review_sync_lock` /
  `release_google_review_sync_lock` share the sync gate (`GOOGLE_SYNC_REVIEWS`),
  so an authenticated caller cannot lock or wedge another office's sync by id.
  Both are covered by the deploy verifier.
- `notify_new_google_review` notifies only this office's operators plus admins,
  with a per-recipient dedupe key (`...:<recipient>`) because
  `emit_notification`'s unique index is on `dedupe_key` alone.
- Verification: `/tmp/phase5_verify.sql` (115/115) and
  `supabase/diagnostics/office_google_phase5_deploy_verify.sql` (76/76, read-only).
- i18n: `googleReviews.*` in en/ar/he (both `public/locales` and bundled
  `src/locales`); nav `nav.googleBusinessOverview` / `nav.googleReviews` under the
  `nav.googleBusiness` group. UI lives at `/team/google/reviews`.

## Office Google Business profile management (Phase 6, 2026-10-01)
- Migration `20261001200000_office_google_profile_management.sql` turns
  `office_google_profiles` from a mapping row into the editable mirror of the
  Google location: identity, contact, categories, address and regular/special
  hours, plus `profile_version` and a canonical `content_hash`.
- **Google stays the source of truth.** `normalizeGbpProfile` in
  `src/lib/googleBusinessGateway.ts` maps a Google location resource into the
  DARB shape and never invents a value for a missing field; sync only advances
  `profile_version` when the canonical hash actually changes, so an unchanged
  poll is a no-op and a re-sync cannot clobber an in-flight edit.
- **Writes are mask-scoped PATCHes.** `buildGbpLocationPatch` emits only the
  fields that changed and collapses `latitude`/`longitude` into one `latlng`
  mask and the two address lines into one `storefrontAddress.addressLines`
  entry, so Google never sees a duplicate mask path.
- **High-risk fields are change-requested, not written.** Primary/Side Manager
  may publish name, description, website, phones, additional categories and
  hours directly (`GOOGLE_UPDATE_HOURS` / `GOOGLE_UPDATE_ATTRIBUTES` etc.).
  Primary category and address need an Admin-approved
  `google_profile_change_requests` row; approval and the actual Google publish
  are separate steps so a failed publish is observable, never a false success.
- **Optimistic concurrency + idempotency.** `admin_update_google_profile` takes
  `expected_version` (a mismatch returns `conflict` rather than overwriting) and
  an idempotency receipt keyed per office so a retried request cannot
  double-write. `#variable_conflict use_column` is required where a PL/pgSQL
  parameter name collides with a column.
- Change-request immutability trigger allows a `PENDING` request to be revised
  but not a decided one; `google_profile_field_error` is pure IMMUTABLE, not
  SECURITY DEFINER.
- Verification: `/tmp/phase6_verify.sql` (151/151) and
  `supabase/diagnostics/office_google_phase6_deploy_verify.sql` (92/92, read-only).
- i18n: `googleProfile.*` in en/ar/he (`public/locales` only — `dashboard` is not
  bundled in `src/locales`); nav `nav.googleProfile` under the `nav.googleBusiness`
  group. UI lives at `/team/google/profile`.

## Office Google Business performance + insights (Phase 8, 2026-10-02)
- Migration `20261002140000_office_google_performance.sql` adds three tables:
  `google_business_performance_daily` (one row per location/date/metric/scope/
  entity, `metric_value BIGINT`, `data_state` VALUE|ZERO|NO_DATA),
  `google_business_search_keywords_monthly` (monthly, `insights_value_type`
  VALUE|THRESHOLD), and `google_business_performance_sync_jobs`. The extra
  `metric_scope`/`entity_type`/`entity_id` columns exist so a future Google Post
  metric can live beside location metrics without a schema change.
- **Merging a later phase into Phase 8 must not revert the authorizer.** Phase 8
  redefines `authorize_google_office_action` and `google_actor_can`, so when it
  merges with a migration that added actions (Phase 7's `GOOGLE_SYNC_MEDIA`,
  `GOOGLE_SYNC_POSTS`, `GOOGLE_MANAGE_CUSTOMER_MEDIA`), the Phase 8 copy must
  carry those actions forward. Its redefinition originally dropped them, which
  would break media/post sync and reopen customer-media moderation. The migration
  is therefore timestamped `20261002140000` (newer than Phase 7's `...120000`,
  per the manual-deploy rule that a redefining migration sorts after what it
  redefines), and the Phase 8 deploy-verify asserts the union so the regression
  cannot silently return.
- **The dashboard reads Supabase, never Google.** Only `syncGooglePerformance` /
  `backfillGooglePerformance` in `src/lib/googleBusinessPerformance.functions.ts`
  call the Performance API, through the Phase 2 connector gateway
  (`businessprofileperformance/v1`). OAuth is reused; no second Google login.
- **Google omissions are not zeros.** `normalizeMultiDailyMetrics` stores a
  datapoint with no `value` as `ZERO` and a metric the office never reported as
  `NOT_AVAILABLE`, so the UI shows "Not available" rather than a fabricated 0.
  `connectNulls={false}` keeps a missing day a gap in the chart.
- **A keyword threshold is never an exact number.** Google returns a union of
  `value`/`threshold`; `normalizeSearchKeywordCounts` keeps the type and the UI
  renders `<15`.
- **Keywords are fetched one month at a time.** The endpoint AGGREGATES over the
  whole `monthlyRange` and returns no per-month field, so a multi-month request
  cannot be attributed to any month. `keywordSyncMonths` (current + 5 prior) is
  fetched as one single-month request per month, each stored under its own
  `month`; the keyword table shows a Month column. Keyword reads use their own
  rolling 6-month window, not the metrics preset, so a 7-day view still shows
  search discovery. A failed keyword read surfaces an error, never an empty
  table (no laundering query errors into `[]`).
- **Period comparison is DARB's, and labelled so.** `percentChange` returns null
  for a zero baseline ("No previous baseline"), never infinite growth; cards say
  "vs previous period". Admin "All offices" is explicitly badged
  `DARB aggregate` with a note that Google publishes no combined figure, and the
  per-office list is a plain measurement, no "best/worst office" labels.
- **Office-first authorization.** Every RPC resolves office -> membership ->
  Google operator -> `office_google_profiles`; a client never supplies a Google
  location id. Read RPCs gate on `GOOGLE_VIEW_INSIGHTS`, sync on the new
  `GOOGLE_SYNC_PERFORMANCE`; the daily/keyword triggers reject a row whose
  `google_location_id` does not belong to the row's office. The performance
  tables' RLS policies and `list_google_performance_offices` use the same
  `GOOGLE_VIEW_INSIGHTS` check (not plain office membership), so an ordinary
  member cannot read analytics or enumerate offices through the browser client.
- Sync is lock-guarded, retries with capped backoff, never retries 401/403, and
  re-fetches a recent window with UPSERT so late Google corrections land.
  Metrics and keywords are separate jobs: a keyword failure returns PARTIAL and
  keeps the healthy metrics.
- **The sync lock is owner-tokened, and finalizers verify the job.** `acquire_*`
  returns a random token; `release_*` and both finalizers require it, and the
  stale window is clamped server-side (60s..1800s) so a caller cannot widen it.
  A finalizer only writes for a `RUNNING` job of its expected type while the
  caller still holds the lock, and reconciliation deletes are conditional on the
  same lock, so an older completion cannot poison or erase a newer sync's rows.
  The finalizer does NOT clear the lock — the caller owns the lock lifecycle,
  which keeps multi-chunk backfill working (chunk 2 must still hold the token).
  `admin_fail_google_performance_sync_job` validates job status and token
  *before* any write, so an operator cannot abort another sync's job.
- **`data_through` is the newest datapoint Google actually returned**, not the
  requested end date, and the previous value is preserved when a response has
  none — so a lagging or empty sync cannot be shown as Healthy. Keyword
  reconcile deletes terms Google no longer returns for the refreshed months.
- **A truncated keyword listing never reconciles.** `collectAllPages` now returns
  `{ items, complete }`; hitting the page ceiling or a repeated cursor marks the
  month incomplete, and the keyword sync fails (retryable
  `GOOGLE_PERFORMANCE_PAGINATION`) instead of deleting terms Google still
  reports.
- CSV export neutralizes spreadsheet formula injection (`= + - @ tab CR LF`) in
  keywords, office and location names, and the keyword export walks every page
  (bounded) so it is not limited to the first 100 rows.
- Verification: the migration applies cleanly on a real Postgres 17 with stubbed
  `auth`/`authorize`; runtime checks confirm a foreign failure token is rejected
  while the job stays RUNNING, a live token finalizes and clears the lock, a
  forged metrics finalizer is rejected, RLS hides rows without
  `GOOGLE_VIEW_INSIGHTS`, and keyword reconcile removes a dropped term. Unit
  tests: `src/lib/googleBusinessPerformance.test.ts`,
  `src/lib/googlePerformanceExport.test.ts`, `src/lib/googleBusinessLocation.test.ts`.
- i18n: `googleInsights.*` + `nav.googleInsights` in en/ar/he
  (`public/locales` only — `dashboard` is not bundled in `src/locales`). UI at
  `/team/google/insights`; nav entry under the `nav.googleBusiness` group.
- Verification: `supabase/diagnostics/office_google_phase8_deploy_verify.sql`
  (read-only).

## Office Google Business photos + posts (Phase 7, 2026-10-02)

- Migration `20261002120000_office_google_media_posts.sql`. Two caches:
  `google_business_media` and `google_business_posts`, each keyed by
  `(google_location_id, google_<resource>_id)` so a re-sync cannot duplicate.
- **Customer media is separated by `media_origin` ('BUSINESS' | 'CUSTOMER'),
  not a second table.** Customer rows are VIEW ONLY: `admin_mark_google_media_deleted`
  refuses them and the UI hides edit/delete. `GOOGLE_MANAGE_CUSTOMER_MEDIA` is
  deliberately not operator-held (the authorizer returns false for it).
- **DARB category != Google category.** `darb_category` is the friendly label
  (`cover`/`logo`/`exterior`/`interior`/`team`/`other`); `media_category` is
  Google's enum. `googleMediaCategoryFor` maps to COVER/LOGO/EXTERIOR/INTERIOR/
  TEAM/ADDITIONAL and the DARB word is never sent.
- **Two publish paths, deliberately.** Location photos use the byte upload
  (`media:startUpload` -> upload bytes -> `Media.Create` with `dataRef`); Local
  Post media must be a URL, so `resolve_google_post_media_urls` returns the
  Google-hosted URL of a same-office BUSINESS media row. Post media is capped at
  1 (`media_ids` max 1) in the composer.
- **Google is the source of truth.** Sync upserts and marks rows Google no longer
  returns (`NOT_FOUND` for media, `DELETED_EXTERNALLY` for posts) instead of
  deleting, so an external change is visible and the audit trail survives.
- **Persist only after Google confirms.** Upload: stage -> startUpload -> bytes ->
  Create -> `record_google_media_upload`. Publish: local draft -> Google create/
  patch -> `admin_apply_google_post_publish`. A failure marks FAILED and keeps the
  draft; a network failure is reported `uncertain`, never retried blindly.
- **Irreversible actions guarded at the RPC.** Publish/delete use
  `acquire_google_post_publish_lock` / `acquire_google_post_delete_lock`
  (advisory, self-expiring) plus `google_post_operation_receipts` keyed per
  office so a double tap or retry returns the first result. Media uploads use
  `google_media_upload_receipts` + `begin_google_media_upload`.
- **Optimistic concurrency.** `google_business_posts.version` +
  `expectedVersion` on update; a stale editor gets `conflict`, never a silent
  overwrite.
- **Bytes are validated, never the filename/MIME.** `sniffImageMime` /
  `validateMediaBytes` check magic bytes server-side; a JPEG named `.png` is
  rejected before Google is called.
- `gbpPost` and `gbpUploadBytes` in the gateway are NOT retried on 5xx (only
  429), because a replay after Google already created the resource would
  double-create.
- `src/lib/googleBusinessMedia.functions.ts` and
  `googleBusinessPosts.functions.ts` are the server layer; pure helpers and
  normalizers live in `googleBusinessGateway.ts`. Tests:
  `src/lib/googleBusinessMediaPosts.test.ts`.
- Verification: `supabase/diagnostics/office_google_phase7_deploy_verify.sql`
  (read-only). i18n: `googleMedia.*` / `googlePosts.*` in en/ar/he
  (`public/locales` only — `dashboard` is not bundled in `src/locales`); nav
  `nav.googlePosts` / `nav.googlePhotos` under the `nav.googleBusiness` group.
  UI at `/team/google/photos` and `/team/google/posts`.
