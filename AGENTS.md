# Raneem (DARB) ŌĆö Agent Notes

Repository-specific context for the DARB case-management app (Vite + React + Supabase).

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

## Build / test
- `npm run build` ŌåÆ `tsc && vite build` (this is the real gate; eslint is not part of build).
- `npm test` ŌåÆ vitest (unit tests).
- `npm run test:e2e` ŌåÆ Playwright.

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