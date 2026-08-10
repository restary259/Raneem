# Raneem (DARB) — Agent Notes

Repository-specific context for the DARB case-management app (Vite + React + Supabase).

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
