# Branded Student Invoice Email — Step 1 Audit + Implementation Plan

## Audit: where the money actually lives

Traced chain (all verified in DB + code this turn):

```text
cases (case_reference, full_name, email, assigned_to, student_user_id)
  -> case_submissions (student_email, program/accommodation/insurance + EUR prices)
  -> case_services      (frozen snapshot: description, category, quantity,
                         unit_price, discount, currency, catalog_version)
  -> case_payments      (payment_type='agency_service', currency ILS,
                         status pending/submitted/confirmed/rejected)
  -> get_case_financials(case_id)   <-- THE source of truth (SECURITY DEFINER)
  -> issue_case_invoice(case_id)    <-- freezes that jsonb into case_invoices.totals
  -> case_invoices (invoice_number DRB-INV-YYYY-NNNNNN, public_token, student_email,
                    email_status/email_error/email_sent_at)
  -> /invoice/:token page + invoicePdf  (both via selectInvoiceTotals)
  -> send-transactional-email -> template 'case-invoice'
```

Source of truth confirmed:
- Prices: `case_services` snapshots (`unit_price`, `discount`, `catalog_version`) — the catalog is never re-read at invoice time, so requirement 10 (price-snapshot immutability) is already satisfied by the existing architecture.
- Totals: `get_case_financials` computes `service_total`, `total_confirmed` (confirmed ILS agency payments only), `total_pending_review`, `remaining = max(total-confirmed,0)`. No frontend re-adds money.
- Currency split: ILS = DARB agency services; EUR = school/accommodation/insurance, returned separately as `school_costs` with `estimate: true`. The invoice deliberately excludes EUR from the ILS total.
- Recipient: `case_submissions.student_email` falling back to `cases.email`, frozen on `case_invoices.student_email`.
- Auth: `get_case_financials` allows admin / assigned team / the student. `issue_case_invoice` allows admin / assigned team. `send-transactional-email` requires an admin or team_member JWT.

Data check: 47 `case_services` rows, 3 agency payments, 0 rows with a discount, 0 invoices issued so far.

## Gaps found (what's actually wrong today)

1. **The email shows almost nothing.** `sendInvoiceEmail` sends only `serviceTotal` — the `case-invoice` template already accepts `totalConfirmed`/`remaining` but they are never passed, and there is no per-service line-item table at all. The user's requested layout (services, subtotal, discount, total, paid, remaining) does not exist in the email.
2. **Security hole:** `CaseFinance.tsx` lets staff type any address into the send box and overrides `invoice.student_email` client-side, so a student's financial data can be mailed anywhere. Server never validates the recipient against the case.
3. **Stale numbers on re-send.** `case_invoices.totals` is frozen at issue time; the "Send invoice" buttons in `CaseFinance` / `CaseInvoiceBlock` re-send the old snapshot after new payments are confirmed, so Paid/Remaining can be wrong (requirement 11).
4. **No guard rails:** an invoice with zero services or a missing student email can still be issued and sent.

## Plan (incremental, matching your Steps 2–5)

### Step 2 — Data layer (no new pricing system)
- Extend `src/utils/invoiceTotals.ts` `selectInvoiceTotals` to also expose `subtotal` (sum of `unit_price*quantity`), `discount_total` (sum of `discount`), plus the existing `service_total`, `total_confirmed`, `remaining`, and an optional `school_costs` (EUR) list. One function, reused by the invoice page, the PDF, and the email payload — no duplicated math.
- Add a small `buildInvoiceEmailData(invoice)` in `CaseInvoiceService.ts` that maps a `CaseInvoice` into the email props (line items with formatted en-US amounts, subtotal, discount, total, paid, remaining, EUR block only when non-empty). Fields that don't exist (no discount, no payments) are omitted, never fabricated.
- Migration: make `issue_case_invoice` refuse to issue when there are no `case_services` rows or no resolvable student email, so an incomplete invoice can never be created.
- Unit tests in `src/utils/invoiceTotals.test.ts` for subtotal/discount/paid/remaining, legacy snapshots, and the snapshot-vs-catalog case.

### Step 3 — Branded email template
- Rewrite `supabase/functions/_shared/transactional-email-templates/case-invoice.tsx` as a real invoice document using the existing `email-ui` kit (logo, gold rule, footer) so branding matches the other 10 templates: header + invoice no./date, student name + case reference block, a table-based services list (description × qty, amount), subtotal / discount / total, then Paid and Remaining highlighted, an optional clearly-labelled EUR "paid directly in Germany — estimate" section, then the CTA to the public invoice page.
- Email-safe only: nested tables, inline styles, no flex/grid, RTL by default with LTR-forced numerals; preview text and `previewData` for the preview function.

### Step 4 — Sending, server-side authorization
- Server-side recipient lock: `sendInvoiceEmail` stops accepting an arbitrary address. The edge function path resolves the recipient from `case_invoices.student_email` for `templateName === 'case-invoice'` and rejects a mismatch, so requirement 8 holds even if the client is tampered with.
- Fresh numbers on every send: the send path re-issues via `issue_case_invoice` (idempotent, keeps the same invoice number and token) before rendering, so Paid/Remaining always reflect current confirmed payments.
- Remove the free-text recipient input in `CaseFinance.tsx` (show the locked student email read-only instead); keep `CaseInvoiceBlock` behaviour otherwise unchanged.
- Error paths: no email / no services / financials unreadable / provider failure → no send, `email_status='failed'` with the reason, clear toast. Deploy the affected functions.

### Step 5 — End-to-end verification with real data
- Use a real case that has `case_services` rows, issue the invoice, and produce the field-by-field comparison table (name, email, each service + price, subtotal, discount, total, paid, remaining, currency) sourced from SQL vs the rendered email.
- Price-change test: bump the catalog for a service, re-issue, confirm the invoice still shows the snapshot price.
- Payment-change test: confirm an additional payment, re-issue, confirm Paid/Remaining move correctly with no duplicate payment rows.
- Render check of the HTML at desktop and mobile widths via the preview function.

## Risks
- Re-issuing on send updates `issued_at`; acceptable (invoice number and public token stay stable), but it means the PDF date reflects the last issue. Flag if you'd rather freeze `issued_at` at first issue — that is a one-line change.
- Tightening `issue_case_invoice` could block a case that legitimately has zero services; current data shows every case in play has services.
- Template changes require redeploying the email functions; no data migration needed.

## Not touching
Finance tab layout, pricing rules, commission logic, payment recording, and the existing `get_case_financials` math all stay as they are.
