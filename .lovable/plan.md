# Rebuild and align every DARB invoice view

## Audit findings

- Team, Admin, and Student ultimately open the same public invoice page, while Admin can also download the PDF directly.
- The current public invoice is a plain generic card and does not carry the logo, gold rule, spacing, hierarchy, or polished document structure used by the invoice email.
- The downloaded invoice uses the shared report exporter, which creates the generic navy/blue table the user flagged. It has no invoice-specific masthead, document metadata block, payment state, branded footer, or proper invoice composition.
- The PDF filename is currently built with `.pdf` twice.
- All three surfaces use the same frozen invoice totals, but their visible content is inconsistent: the email can include estimated Germany costs while the public page and PDF intentionally exclude them. DARB invoices are for DARB services in ILS; Germany provider costs must remain separate.

## Rebuild

1. **Create one invoice presentation model**
   - Derive the service lines, subtotal, line discounts, referral discount, net total, confirmed amount, remaining balance, payment state, student, file number, invoice number, and issue date from the existing frozen invoice snapshot.
   - Use this same prepared model for the public invoice, branded PDF, and invoice email so labels, row visibility, amounts, and payment status cannot drift.
   - Keep Germany school/provider costs outside the invoice total and replace their email-only list with the same clear separation note shown on the other invoice surfaces.

2. **Rebuild the public invoice page**
   - Match the email’s restrained DARB document language: centered DARB logo and wordmark, thin gold accent, clean white document, structured invoice details, service table, totals, paid/remaining state, separation note, and support footer.
   - Keep the download action visible without making it part of the printed document.
   - Make the document fit phone, tablet, laptop, and wide screens without clipped rows or horizontal scrolling.
   - Preserve natural Arabic RTL and English LTR, Western numerals, and readable mixed-direction invoice numbers and currency values.

3. **Replace the generic blue PDF with a dedicated branded invoice PDF**
   - Build an invoice-specific A4 layout rather than passing invoice data through the generic report-table exporter.
   - Include the DARB logo/identity, invoice metadata, service details, discounts, total, confirmed payment, remaining balance or fully-paid status, separation note, and a restrained footer with page numbering.
   - Use the existing bundled Arabic font and correct RTL shaping; keep long service descriptions wrapped and multi-page invoices repeatable without clipping.
   - Correct the downloaded filename so it ends in exactly one `.pdf`.

4. **Align role entry points**
   - Team Finance, Admin review, and Student Fees will continue opening the same canonical invoice document.
   - Keep Admin’s direct PDF and resend controls, but make its PDF identical to the one downloaded from the public invoice.
   - Preserve invoice issuance, permissions, recipient locking, resend behavior, and all payment/business logic unchanged.

5. **Verification**
   - Add focused tests for the shared presentation model, conditional discount/payment rows, Germany-cost exclusion, Arabic/English labels, and filename handling.
   - Generate English and Arabic sample PDFs, render every page to images, and visually inspect logo quality, RTL, wrapping, page breaks, margins, totals, and footer placement.
   - Capture the public invoice at phone, tablet, laptop, and wide desktop sizes in English and Arabic.
   - Verify Team, Admin, and Student invoice actions all reach the canonical design, then run invoice/i18n tests and confirm the preview build is healthy.

## Technical scope

- Frontend invoice presentation, PDF generation, shared invoice formatting, email-template alignment, translations, and tests only.
- No changes to invoice issuance, stored totals, payment confirmation, commissions, recipient security, or access rules.
