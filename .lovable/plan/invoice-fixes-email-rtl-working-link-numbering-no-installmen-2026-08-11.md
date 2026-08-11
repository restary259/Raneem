# Invoice fixes — email RTL, working link, numbering, no installments

## What is actually wrong (verified)

1. **The "عرض الفاتورة وتنزيلها" button does nothing** — what you clicked is the email *preview*, whose sample link is the placeholder `https://darb.agency/invoice/abc123`. No invoice with that token exists, so the page shows "invoice not found". The route `/invoice/:token` and its public lookup are wired correctly and are readable without login.
   Separately, real emails build the link from `window.location.origin`, so an invoice emailed from the Lovable preview window carries a preview URL instead of `https://darb.agency`. That is a real bug and gets fixed.
2. **Arabic renders left-aligned / scrambled in Gmail** — the template sets `dir="rtl"` only on `<html>`/`<body>`, and Gmail strips both. Every visible block (container, sections, table cells, headings, paragraphs) needs its own `dir="rtl"` plus right alignment.
3. **Meta rows run together** ("رقم الفاتورةDRB-INV-…") — the label/value table has no spacing or separation, so in Gmail the two cells collide.
4. **Invoice number does not match the case number** — invoices use their own counter (`DRB-INV-2026-000001`) while the case is `DRB-2026-000031`.
5. **Installment wording** — the email says "ملخص الدفعات" and always prints a "الرصيد المتبقي" line, which reads like an installment plan.
6. **No invoices exist in the database right now**, so nothing is broken in live data — these are template/logic fixes.

## Fixes

### A. Email renders correctly in Gmail (Arabic RTL)
- Add explicit `dir="rtl"` and `text-align: right` on the layout container, content section, heading, paragraphs, footer, and on every table/`td` in the invoice template (Gmail-safe: attributes + inline styles, no CSS classes).
- Keep numbers, currency, invoice/case references wrapped in the existing LTR span so digits never flip.
- Rebuild the meta block as label-on-right / value-on-left rows with real padding and a divider so "رقم الفاتورة" and its value can never touch.
- Apply the same `dir` handling to the shared email layout so the other templates benefit.

### B. The invoice link always works
- Build the link from the canonical site URL (`https://darb.agency`) instead of `window.location.origin`, so an invoice sent from any browser or preview points at production.
- Change the preview sample link to the real invoice route with a clearly fake-but-harmless token, and label it as sample data.
- Re-verify `/invoice/:token` end-to-end after issuing a test invoice: page loads logged-out, PDF downloads, Arabic PDF stays right-to-left.

### C. Invoice number = case number
- Derive the invoice number from the case reference: case `DRB-2026-000031` produces invoice `DRB-INV-2026-000031` (one invoice per case, so the number stays unique and re-issuing keeps the same number). Fall back to the old sequence only if a case somehow has no reference.
- Update the email, invoice page, and PDF automatically — they all read the stored number.

### D. Remove installment framing
- Reword the intro to a single-invoice statement (no "ملخص الدفعات").
- Show "المدفوع" and "الرصيد المتبقي" only when a payment has actually been confirmed and the balance is not zero; a fully unpaid invoice shows just the total, a fully paid one shows a "مدفوعة بالكامل" status instead of a balance line.

### E. Connected-surfaces checklist (verify, fix only if broken)
- Invoice issuance on submit-to-admin → invoice row, email queued, student invite email.
- Admin invoice block: view / PDF / resend, recipient locked to the stored student email.
- Public invoice page (logged out) and PDF in both Arabic and English.
- Student Fees page shows the same total as the email and the invoice page.
- Spreadsheet Hub (Students + Payments sheets) service-fee totals reconcile with `case_services`, and Excel/PDF exports open cleanly with Arabic.
- Finance tab totals (service total / paid / remaining) match `get_case_financials`.

## Technical notes
- Files: `supabase/functions/_shared/transactional-email-templates/case-invoice.tsx`, `supabase/functions/_shared/email-ui/components.tsx`, `src/services/CaseInvoiceService.ts` (`invoiceUrl`), plus one migration updating `issue_case_invoice` numbering.
- No change to the money math: `get_case_financials` stays the single source of truth and `selectInvoiceTotals` stays the single renderer-side derivation.
- Existing invoices keep their current numbers; the new scheme applies to newly issued ones (the table is currently empty).
