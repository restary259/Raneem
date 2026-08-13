# Raneem (DARB) — Agent Notes

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
  `src/i18n.ts`), so a failed/late `/locales/*.json` load suspends → fallback,
  not an unhandled throw. Never remove this top-level Suspense boundary; the
  inner Suspense boundaries in `App.tsx` sit *below* the `useTranslation` call
  and cannot cover it.
- `vercel.json` rewrites `/((?!locales/).*)` → `/` so the i18next HttpBackend
  `/locales/{{lng}}/{{ns}}.json` requests are served as static JSON
  (`application/json`), never rewritten to `index.html`. `public/locales/**`
  is copied into `dist/locales/**` by the Vite build.

## Finance tab architecture

- `src/components/cases/CaseFinance.tsx` — orchestrator of the Finance tab. Renders the
  KPI summary (Service total / Paid / Awaiting / Remaining) from `get_case_financials`,
  the DARB service selector, the payment-confirmation card, payment history, the
  Germany (EUR) cost + proof-verification block (admin only / final stages), the
  submission-readiness checklist, and a single **Confirm & Save** action.
- `src/components/cases/CaseServices.tsx` — the single service-package selector.
  Exposes an imperative handle (`CaseServicesHandle`: `save`, `isDirty`,
  `selectedCount`) via `forwardRef` so the parent's one button persists the selection.
  A single `Select` chooses **Full Service** (locked, auto-populated bundle from
  catalog rows where `in_full_service = true`) vs **Custom Services** (editable
  per-service checkboxes). There is no separate Save button in this component.
- `src/components/cases/CasePayments.tsx` — payment history only. Business-rule notes
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

### Finance → Submit-to-Admin flow (single place)
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
  dialog/`CaseInviteStudent` inline — it only points back to the Finance tab.
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
  `v_base` (gross, all `case_services` rows — NO `currency='ILS'` filter, matching
  `get_case_darb_service_total` which sums all rows and hardcodes `currency='ILS'`),
  then `v_net = GREATEST(v_base - referral_discount, 0)`, and
  `platform_revenue_ils = GREATEST(0, v_net - team - pool)`. Team/partner/master
  flat commissions are UNCHANGED (flat amounts, not a % of base) and keep using
  gross `v_base` as `rewards.base_amount`. The `IF v_base <= 0` guard stays on
  gross. The audit payload logs BOTH `base_amount` (gross) and
  `net_after_discount` (net). This matches `COMMISSION_RULES.md` §4 where
  `service_fee` is the NET discounted DARB total.
- Worked example (₪5000 case, ₪500 discount, ₪100 team, student referrer so ₪0
  pool): invoice/finance `service_total` = ₪4500; admin split preview platform
  revenue = ₪4500; recorded `platform_revenue_ils` = ₪4500 (was ₪4900 before fix).
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
  the one place `referral_discount` is parsed (clamped to ≥0, defaults to 0 for
  missing/non-numeric/legacy snapshots) and exposed on `DarbInvoiceTotals`. Every
  display surface derives from it; nothing re-parses the raw snapshot. The math
  reconciles: `subtotal − per-line discount_total − referral_discount = service_total`.
- **Surfaces that show the breakdown** (only when `referral_discount > 0`; no
  change when there is no discount):
  - `CaseFinance.tsx` Summary tab: KPI grid + an Original/Discount/Net block + an
    emerald "Referral discount applied" badge notice; Invoice tab: Original/Discount/Net
    rows replace the single "Service total" row.
  - `StudentFeesPage.tsx`: Original/Discount/Net block under the agency-services KPI grid.
  - `InvoicePage.tsx` (public invoice) + `invoicePdf.ts` (PDF): a `−₪` Referral
    discount row above the final total.
  - `case-invoice.tsx` email template: a separate `خصم الإحالة` LineRow after the
    per-line discount and before the total (`referralDiscount` prop from
    `buildInvoiceEmailData`); the existing `discount` prop still maps to the
    per-line `discount_total` only, so the two discounts are never conflated.
  - `AdminSubmissionsPage.tsx` Payment-Split panel: a read-only emerald line
    above the Service Fee indicating the discount was applied (Service Fee stays
    the net `service_total` the commission is computed on — `record_case_commission`
    already nets referral_discount, so platformRevenue is unchanged).
- **i18n**: keys under `finance.summary.*` (originalTotal/referralDiscount/netTotal),
  `finance.referral.*` (applied/appliedDesc), `studentFees.*` (originalTotal/
  referralDiscount/netTotal), `admin.submissions.referralDiscount` — added to en + ar
  together (parity guarded by `src/lib/i18nKeys.test.ts`).
- Build: `npm run build` (tsc+vite) clean; `npx vitest run` 317/317 pass incl. 2
  new `invoiceTotals.test.ts` cases (parse + reconcile) + i18n parity guard.

## Form draft autosave — 30-min inactivity expiry (2026-08-13)
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
  without needing a refresh — no per-second re-renders. `clearDraft()` clears it
  and also clears the idle timer.
- New return fields: `expiresAt` (= `savedAt + TTL`, for the status UI),
  `expired` (set once on mount-expiry/active-expiry), `acknowledgeExpired()`.
  `savedAt`, `clearDraft`, `acknowledgeRestore` unchanged.
- **Consumers** (both call `clearDraft()` strictly after backend success; the
  catch/failed path does NOT clear, so the user can retry):
  - `ProfileCompletionForm.tsx` — key `profile-completion:<caseId>` (per-case).
  - `SubmitNewStudentPage.tsx` — key `submit-new-student` (one per device; left
    as-is). Key scoping to the auth user id was NOT added (would break existing
    valid drafts mid-session); only one new-student draft at a time per device.
  - The separate server-side draft in `CaseProfileForm.tsx`
    (`case_submissions.draft_updated_at`) is real submission data, NOT this
    localStorage system — out of scope, unchanged.
- **Status UI**: `src/components/common/DraftStatus.tsx` renders a subtle
  "✓ Auto-saved · Expires in N min" line (emerald) that switches to amber under
  5 min, plus an optional secondary "Clear draft" button (confirms, calls
  `clearDraft`, resets fields — never touches the case/submission record). A
  30s `setInterval` updates only a small local "minutes remaining" state — it
  never re-renders the parent form. When `expired` is set, it shows the expiry
  notice instead. Used by both forms near their footer. Respects RTL (logical
  props, dir-aware via the existing layout).
- **i18n**: new keys under `common.draft.*` (`autoSaved`, `expiresIn`,
  `expiringSoon`, `expired`, `expiredBody`, `clearDraft`, `clearDraftConfirm`)
  added to en + ar (parity-guarded by `src/lib/i18nKeys.test.ts`).
- Tests: `src/hooks/useFormDraft.test.ts` (10 cases, fake timers) — fresh /
  10-min / 29-min restore, 30-min+1s expired+removed, version mismatch, write
  resets the timer, active expiry while mounted, clearDraft, key isolation,
  disabled. Build clean; `npx vitest run` 327/327 pass (+10 new).

## Student account creation / invite (no dead activation links)

- `create-student-from-case` (edge function) has three invite-mode branches and
  must never send an activation link to an email that `accept-invitation` would
  reject:
  1. **Email already linked to a `case_submissions` student** (existing linked
     account): link the case, return `invited: false` — no email (the student
     already has an activated account).
  2. **Existing activated STUDENT account** (not this case): in invite mode,
     link the case and return `invited: false, already_activated: true` — no
     email. In manual mode, reset the password (admin-only) and return it.
  3. **Brand-new email**: in invite mode, do **not** pre-create the auth account
     (`admin.createUser`); `sendInvite` mints a durable `user_invitations` row
     (with `case_id`, `intended_role = "student"`, `invited_name`) and
     `accept-invitation` creates the account, assigns the role, upserts the
     profile, and links the case at activation. Manual mode still creates the
     account and returns a temp password. Pre-creating in invite mode caused
     resend races to hit "email already belongs to an account" at activation.
- **Invitation reconciliation (2026-08-13)**: a pending `user_invitations` row
  is closed (status → accepted) whenever the corresponding student account
  becomes active by ANY creation path, not only via `accept-invitation`. Manual
  accounts are delivered as a temp password and the student signs in directly
  (never calling `accept-invitation`), so the one row that used to flip
  pending→accepted never ran — leaving a stale pending invitation that kept
  rendering under "Pending invitations" while the account was already active.
  Three layers now close it:
  1. `reconcilePendingInvitations(admin, { email, userId, invitationType })` in
     `supabase/functions/_shared/invitations.ts` — idempotent UPDATE
     (already-accepted → no-op), logs a structured `student_invitation_reconciled`
     event (never logs tokens/passwords), non-fatal on error. Called after
     account creation/case-linking in: `create-student-from-case` (manual main
     path + the already-activated invite branch + the linked-account early
     returns, both manual & invite) and `create-student-standalone` (after
     role/profile/case-link).
  2. DB trigger `trg_reconcile_student_invitations` (migration
     `20260813150000_reconcile_student_invitations.sql`) — SECURITY DEFINER
     `AFTER INSERT ON user_roles` where role='student', joins
     `profiles.email` → `user_invitations.invited_email` (lower-cased),
     type='student', status='pending' → accepted. Idempotent, no recursion
     (updates a different table), no RLS weakening. Covers ANY path that
     provisions a student role without going through the edge functions.
  3. Same migration runs a one-time idempotent data cleanup closing existing
     stale pending student invitations whose email already belongs to an active
     (non-deactivated) student account (correlation from
     `supabase/diagnostics/account_lifecycle_audit.sql` query 7). pending→accepted
     only, never DELETE. A verification SELECT is kept in a comment.
- **Frontend safeguard** (`src/lib/studentInvitations.ts`): pure
  `filterActiveInvitations(invitations, students)` hides any pending invitation
  whose email (trim+lowercase) matches an active student — defense-in-depth if
  DB reconciliation hasn't run yet (replication lag). `TeamStudentsPage` derives
  `visibleInvitations` via `useMemo` and renders that. The active-students query
  DROPPED `.is("case_id", null)` so a manually-created student linked to a case
  appears under active accounts (was previously hidden → vanished from both
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
- `npm run build` → `tsc && vite build` (this is the real gate; eslint is not part of build).
- `npm test` → vitest (unit tests).
- `npm run test:e2e` → Playwright.

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
  writes all three (name + phone inputs → array + mirrors), so filling the contact on
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
  not the filtered "Other requests" tab) — this is intentional.

## pg_cron → Edge Function dispatch auth pattern
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
- `passport_number` removed from ALL app read/write/display paths: StudentOnboardingGate(+test), StudentNextStepsPage, StudentProfile, AdminStudentsPage (PROFILE_SELECT/StudentRecord/editForm/handleSave/edit-form array/read-view rows), ProfileCompletionModal (cases table), sheetQueries + SpreadsheetHub (submission extra_data export column), AdminSettingsPage placeholder, src/types/profile.ts, src/types/database.ts (StudentCase). DB columns on `profiles` and `student_cases`/`cases` were LEFT IN PLACE (no drop migration) — only app usage stopped.
- `src/integrations/supabase/types.ts` (generated) KEEPS `passport_number` on purpose: it mirrors the live retained DB columns; `supabase gen types` would re-add them, so removing is non-durable and diverges from schema. No code reads those generated fields now.
- Orphaned locale keys (`profile.passportNumber`, `admin.ready.passportNumber`, `sheets.col.passportNumber`) LEFT in en/ar for i18n parity — `src/lib/i18nKeys.test.ts` only flags missing keys, not orphans. `passportType` keys are a DIFFERENT concept (passport-type dropdown) and remain in use. `myData.identityDesc` + `student.next.completeProfileDetail` copy updated to drop "passport number".
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
  nullable `language_school_id` FK → `schools(id)`, and `is_universal`.
  Matching is data-driven — no school/city names hardcoded in React.
- Migration: `20260813120000_context_aware_important_contacts.sql` adds the
  columns + CHECK constraints (scope⇔is_universal, school required for
  school_* scopes, city required for city/school_city), backfills every
  existing row to `scope='universal', is_universal=true` (no behaviour change
  until admin re-scopes), and creates the SECURITY DEFINER RPC
  `get_student_important_contacts()` (granted to `authenticated` only).
- **Single source of truth**: the RPC resolves the student's active school
  (auth.uid() → most-recent non-deleted case → `case_submissions.school_id`
  → `schools.city`, falling back to `cases.city`) and returns ONLY the
  applicable active contacts, deduped by id, with a `match_scope` tag
  ('universal'|'school'|'city'|'school_city') for grouping. The student page
  just renders what the RPC returns.
- **Security/RLS**: students canNOT `SELECT important_contacts` directly —
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
  back to `profiles.language_school_id` when the case has no school yet — so a
  student who just picked a school in onboarding sees the right contacts even
  before a case/submission exists). Both RPCs are SECURITY DEFINER, granted to
  `authenticated` only.
- On school selection the wizard calls `get_school_important_contacts` and
  renders a compact live preview (universal + school/city contacts) inline,
  so the student immediately sees the data that applies to their school. The
  preview uses the SAME RPC as the real Important Contacts page — no logic
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
  contacts-preview logic, and per-step persistence are all UNCHANGED — only
  the visual shell and per-step copy changed.
- New reusable **`OnboardingShell`** (`src/components/student/OnboardingShell.tsx`)
  owns layout only: header (back + mono "03 / 16" step counter), journey
  progress (origin stamp → dashed track → plane marker at the REAL completion
  % → destination stamp), section-context row (current section gold/mono +
  "X next" faint), content slot (editorial headline + short explanation +
  field), and footer slot (secondary Back + full-width brand Continue +
  "N steps to go · Saved automatically"). It is presentational — no state.
- Theme: the reference's dark aesthetic was ADAPTED, not copied. The app
  defaults to light (`defaultTheme="light"`, `enableSystem={false}`); student
  routes follow the persisted `darb-theme` pref, so the shell uses semantic
  tokens (bg-background, text-foreground, border-border, bg-brand /
  text-brand-foreground) that work in BOTH light and dark. The reference's
  gold maps to the existing `--brand` DARB orange. No new fonts imported
  (Tajawal/IBM Plex Sans Arabic stay) — no serif, for performance + brand
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
  year → +6) for the `arrival_date` task (new task type `arrival-date`). The
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
  helper — complete when (street + house_number + residential_city) OR the
  legacy `country` is filled — so existing students who only filled the old
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
  grid), `modern-sidebar` (2-column with colored sidebar — NEW 4th template).
  Each lives in `src/components/lebenslauf/templates/` and consumes the SAME
  `CVData` shape + design CSS vars — no per-template data divergence.
- **Design system** (`cvDesign.ts`): `COLOR_PRESETS` (6 presets: Classic Black,
  Academic Navy, Modern Petrol, Forest Academic, Burgundy Academic, Minimal
  Slate), `TYPOGRAPHY_PRESETS` (Professional/Minimal), `FONTS` registry, spacing
  presets (compact/normal/relaxed). `safeAccentOnWhite()` darkens any accent
  until it passes WCAG AA (>=4.5:1) on white — a too-light accent NEVER reaches
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
  (toggled via "Advanced fields" per entry — progressive disclosure).
- **Bullets**: experience/projects/volunteer entries store a `bullets: string[]`
  array (one bullet per line in a textarea, split on newlines). Rendered via the
  shared `<Bullets>` helper in `templateHelpers.tsx`.
- **Shared render helpers** (`templateHelpers.tsx`): `<Bullets>`,
  `<SectionHeading>`, `<SignatureBlock>`, `clean()` (trim/empty-filter),
  `dateRange()` (from–to / Present). All 4 templates import these so rendering
  is consistent and DRY.
- **Labels** (`cvLabels.ts`): section/field labels in de/en/ar. The label
  dictionary is the SINGLE source for preview headings — the content language
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
  (from ≤ to). Errors render inline under the offending field and block
  "Download PDF" until resolved.
- **Print/PDF** (`src/styles/cv-print.css`): the old `position: fixed` preview
  container (which clipped multi-page CVs to one printed page) was removed.
  The print stylesheet now uses normal flow with `@page` margins,
  `break-inside: avoid` on entries, and page-break-before on major sections.
  "Download PDF" calls `window.print()` (the user picks "Save as PDF"); the
  on-screen preview is A4-proportioned so what you see is what prints.
- **i18n parity**: all new UI keys live under `lebenslaufBuilder.*` in
  `public/locales/{en,ar}/resources.json` (the builder uses the `resources`
  namespace). The vitest `i18nKeys.test.ts` parity guard passes — every
  `t("lebenslaufBuilder.*")` key used in source exists in both en and ar.
  Inline English fallbacks (`t("key", "fallback")`) ensure missing keys still
  render.
- **Mobile**: `LebenslaufBuilder` has an Edit/Preview toggle on small screens
  (shows one at a time); on desktop both render side-by-side.
- Build/test: `npm run build` (tsc+vite) clean; `npx vitest run` 343/343 pass
  (incl. 16 new cvDesign color-safety tests + i18nKeys parity guard). ESLint:
  0 errors across all lebenslauf files (5 `react-refresh/only-export-components`
  warnings in `templateHelpers.tsx` are pre-existing pattern, not build-gated).
