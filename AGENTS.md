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
