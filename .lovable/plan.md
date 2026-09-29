# Finance tab: receipts, wire memo reference, clearer Germany section

## What the team will get
1. **Receipt / reference on every payment** — when confirming a DARB payment the team picks the method. Bank transfer requires a transaction reference OR an uploaded receipt (PDF/image); cash needs no extra proof. The receipt shows in Payment History with a "View" link.
2. **Payment reference number for the wire memo** — every case gets a clear payment reference (the case reference, e.g. DARB-2026-0123). It is shown with a copy button on the Finance tab, on the student's Fees page, on the invoice page, invoice PDF and invoice email, with the instruction "Write this number in the transfer memo". When the team confirms a bank transfer, the reference is shown next to the field so they can match the incoming wire. DARB fees stay **one full payment only — no installments**.
3. **Germany section tagged "Step 2 · After admission"** — the EUR school costs and proof verification sit in a collapsible block, collapsed by default until the case is submitted, so agency-fee collection stays uncluttered. No money logic changes there.

## Unchanged
Full-payment rule, commission split, referral discount, service locking, the single Confirm & Save button, the "Create student account & send invite" step, Germany proof review.

## Technical details
- **Migration (new, idempotent):** add `case_payments.reference text` and `case_payments.receipt_path text`. Extend `confirm_agency_service_payment` with optional `p_reference`, `p_receipt_path` (defaults NULL, old callers keep working): bank_transfer requires one of them; receipt path must be under `cases/<caseId>/receipts/`; values stored on the agency payment row. Amount stays the full server total.
- Payment reference = existing `cases.case_reference` (already assigned by `assign_case_reference`); no new numbering. Verify every active case has one; cases missing it get it via the existing function.
- `get_case_financials` payments array gains `payment_method`, `reference`, `receipt_path`.
- Receipts stored in the private `student-documents` bucket, validated by `validateUploadFile`; viewed via short-lived signed URL.
- **Frontend:** `CaseFinance.tsx` — method select, transfer reference input, receipt upload, memo reference with copy button; Germany block in `Collapsible` with "Step 2" badge. `CasePayments.tsx` shows method, reference, receipt link. `StudentFeesPage`, `InvoicePage`, `invoicePdf.ts`, invoice email template show the memo reference line.
- **i18n:** new `finance.*` / `studentFees.*` / invoice keys in en + ar + he.
- **Tests:** unit tests for the bank-transfer requirement, CasePayments rendering, invoice presentation showing the memo reference; SQL checks on a disposable test case (bank transfer without reference rejected, with reference accepted and stored, cash accepted), then cleanup; build + full test run. UI behind team login — request screenshots.
