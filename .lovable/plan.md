# Finance tab: receipts, split payments, clearer Germany section

## What the team will get
1. **Receipt / reference on every payment** — when confirming a DARB payment the team picks the method. Bank transfer requires a transaction reference OR an uploaded receipt (PDF/image); cash needs only the amount. The receipt shows in Payment History with a "View" link.
2. **Split payments (deposits)** — the team enters the amount received (defaults to the remaining balance). Each payment appears in Payment History; the summary shows Paid / Remaining. The case moves to "Payment confirmed" (and can be submitted to Admin) **only when the balance reaches ₪0**. Overpaying is blocked.
3. **Germany section tagged "Step 2 · After admission"** — the EUR school costs and proof verification sit in a collapsible block, collapsed by default until the case is submitted, so agency-fee collection stays uncluttered. No money logic changes there.

## Unchanged
Commission split, referral discount, service locking, the single Confirm & Save button, the "Create student account & send invite" step, Germany proof review.

## Technical details
- **Migration (new, idempotent):** add `case_payments.reference text` and `case_payments.receipt_path text`. New SECURITY DEFINER RPC `record_agency_service_payment(p_case_id, p_amount, p_method, p_reference, p_receipt_path)`:
  - same auth as today (admin or assigned team member), method in cash/bank_transfer, `p_amount > 0`, `p_amount <= remaining` (server-computed from `get_case_darb_service_total` minus confirmed agency payments), bank_transfer requires reference or receipt path, receipt path must live under the case's folder.
  - advisory lock per case to prevent double-submit races; inserts a confirmed `agency_service` row.
  - when confirmed total ≥ service total: performs the existing full-confirmation side effects (finance confirmation row, legacy `payment_confirmed` flag, `profile_completion → payment_confirmed`).
  - `confirm_agency_service_payment` kept as-is for compatibility (becomes the "pay remaining" path internally not needed by UI).
  - `get_case_financials` payments array extended with `payment_method`, `reference`, `receipt_path`.
- Grant execute to `authenticated` only; storage reuses private `student-documents` bucket (path `cases/<caseId>/receipts/...`), validated by `validateUploadFile`.
- **Frontend:** `CaseFinance.tsx` payment card gets amount input, method select, reference input, receipt upload; calls the new RPC via `useCaseFinancials` refetch; "Confirm & Save" stays the single action. `CasePayments.tsx` shows method, reference, receipt link (signed URL). Germany block wrapped in `Collapsible` with "Step 2" badge.
- **Types:** add RPC + columns to generated types after migration.
- **i18n:** new `finance.*` keys in en + ar + he (both locale trees where applicable).
- **Tests:** unit tests for amount/remaining validation helper, bank-transfer requirement, CasePayments rendering of reference/receipt; SQL invariant checks run against the DB (partial payment keeps status, final payment advances, overpay rejected, bank transfer without reference rejected); build + full vitest run.
- **Live check:** run the RPC scenarios on a disposable test case via SQL, then clean it up. UI behind team login — request screenshots.
