# DARB — Finance, Submission & Invoice UI/UX Close-out

Scope: Finance tab, team submission flow, DARB invoice, admin finance/submissions surfaces. The backend architecture from `agent/finance-workflow-alignment` stays as-is; this plan corrects the UI to match it and closes the remaining gaps.

## What the backend already enforces (verified, do not rebuild)

- `submit_case_for_review` already blocks unless: caller is admin or the assigned team member, status is `payment_confirmed`, a submission exists, profile is complete, school + program + start date are set, at least one DARB service exists with total > 0, and confirmed `agency_service` ILS payments >= the service total. It derives payment state from `case_payments`, not from the `payment_confirmed` boolean (it *sets* that boolean). So Gap 2 and Gap 3 are already closed server-side.
- `confirm_agency_service_payment` computes the amount from `case_services` — no client amount input exists anywhere anymore.
- `case_payment_proofs` + `review_case_payment_proof` exist; Germany verification is admin-only.
- `get_case_financials` returns agency services, agency-only payment totals, and school costs as a separate `school_costs` array.

## Real remaining gaps

1. **Invoice is not DARB-only in presentation.** `issue_case_invoice` snapshots the whole `get_case_financials` payload, and the three renderers — `src/pages/InvoicePage.tsx`, `src/utils/invoicePdf.ts`, and the invoice email data in `src/services/CaseInvoiceService.ts` — print the `school_costs` section. Germany costs appear on the DARB invoice.
2. **Finance tab has no submission-status block.** `CaseFinance.tsx` shows services, Germany costs, verification, but nothing about readiness to submit.
3. **Submit dialog is a bare "are you sure".** `CaseStageBlock.tsx` shows no checklist; the confirmation checkbox lives only in the separate payment dialog.
4. **Hardcoded English.** `CaseFinance.tsx`, `PaymentConfirmationForm.tsx`, and parts of `CasePayments.tsx` / `CaseInvoiceBlock.tsx` contain literal English strings and one `window.prompt` for rejection reasons — broken for Arabic and inconsistent with the `t()` rule.
5. **Finance tab layout doesn't read as two tracks.** DARB and Germany blocks look like one continuous payment list; the raw `CasePayments` table at the bottom mixes both.

## Changes

### A. Invoice = DARB services only

- Add a shared selector that takes an invoice `totals` snapshot and returns agency-only figures (services, service_total, total_confirmed, remaining) with `school_costs` dropped.
- `InvoicePage.tsx`: remove the school-costs section; header states this is the DARB agency service invoice (ILS), with a line noting Germany school costs are billed and verified separately.
- `invoicePdf.ts`: drop the school block; keep the ILS service lines and the three summary rows. Arabic/Hebrew font pipeline untouched.
- `CaseInvoiceService.sendInvoiceEmail`: keep sending agency totals only (already does) and add explicit wording that Germany costs are excluded.
- No backend/migration change; the snapshot keeps full financials for audit, the documents render the agency subset.

### B. Finance tab restructured into 4 blocks (`CaseFinance.tsx`)

1. **DARB Services · ILS** — selected service lines with per-line totals, DARB total, then a payment-state row: confirmed (who + timestamp, paid/remaining) or not-yet-confirmed (expected/received/remaining) with the Confirm button for team/admin.
2. **Germany / School Costs · EUR** — per-item `€weekly × weeks = total` from `school_costs`, estimated total, and the "final school invoices may differ" note. No ILS/EUR mixing (already true; keep enforced by rendering each block from its own currency).
3. **Germany Payment Verification** — per-item proof state (awaiting proof / proof submitted / confirmed / rejected), View proof, and Confirm/Reject only when `canConfirm` (admin). Replace `window.prompt` with a proper reject dialog + reason textarea.
4. **Submission status** — readiness checklist derived from live data (profile complete, school selected, course calculated, accommodation, insurance, services selected, agency payment confirmed) plus a read-only "Germany payment — pending admin verification" line, and the Submit-to-Admin action when every item passes and the case is in `payment_confirmed`.

The generic `CasePayments` list stays but is scoped to a collapsible "payment history" under the relevant block rather than a separate mixed table.

### C. Submit dialog (`CaseStageBlock.tsx`)

Replace the plain confirm dialog with: title "Submit case to Admin", the same checklist (each item live-checked, blocking items marked), the single acknowledgement checkbox ("I confirm the DARB agency service fee has been received from the student"), and the note that Germany school payments are verified separately by Admin. No amount input. Submit stays disabled until the checklist passes and the box is ticked; backend errors (`SUBMIT_BLOCKED: …`) are surfaced as a mapped, translated message instead of a raw string.

### D. Bilingual strings

Add the new keys under `case.finance.*` and `case.submit.*` in `public/locales/en/dashboard.json` and `public/locales/ar/dashboard.json`, and convert every hardcoded English literal in `CaseFinance.tsx`, `PaymentConfirmationForm.tsx`, `CasePayments.tsx`, and `CaseInvoiceBlock.tsx` to `t()`. Map each `SUBMIT_BLOCKED` reason to a translated sentence. Verify RTL layout (logical spacing utilities, no `ml/mr`).

### E. Admin side

- `CaseInvoiceBlock.tsx`: move its inline `L` object into the shared `t()` namespace, label the invoice clearly as DARB-services-only, and disable "Issue invoice" when no invoice exists and the case isn't submitted (so admin can't imply a manual bypass of the flow).
- `AdminSubmissionsPage.tsx` / `AdminFinancialsPage.tsx`: confirm the review panel shows the DARB total and the Germany verification state as separate rows; adjust labels only. No logic change.

### F. Verification

- `bunx vitest run` (full suite) after the changes.
- Playwright pass on a case in `payment_confirmed`: open Finance tab, screenshot all four blocks in EN and AR, open the submit dialog, confirm disabled-state logic, then check `/invoice/:token` contains no Germany lines. Screenshots reported back.

## Out of scope

No changes to `set_case_services`, `get_case_financials`, `submit_case_for_review`, `confirm_agency_service_payment`, `review_case_payment_proof`, commission/reward timing, or any area outside the finance workflow.
