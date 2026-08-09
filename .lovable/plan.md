# Batch 7 — Case Submission → Admin Review → Payment Confirmation → Invoice Email

Scope: submission gate, admin review, invoice (data + PDF + email), payment confirmation chain. No payout release, no 20-day lock, no Master Partner recruitment, no Student Dashboard redesign.

## Decisions locked with you
- Invoice is generated and emailed automatically when the team submits the case to admin.
- The email itself carries the full itemised breakdown, plus a button to a hosted invoice page where the PDF can be downloaded (our email system cannot attach files).

## What already exists (verified this turn)
- Authoritative finance: `get_case_financials`, `submit_case_payment`, `confirm_case_payment`, `reject_case_payment`, price snapshots on `case_services` (Batch 6, verified live).
- Submission UI/gate: `CaseStageBlock.tsx` + `CaseDetailPage.tsx`; admin review list already exists at `AdminSubmissionsPage.tsx` (`status in ('submitted','payment_confirmed')`).
- Email infrastructure is live and healthy: verified sender `support.darb.agency`, From `noreply@darb.agency`, queue-based `send-transactional-email`, shared design system in `_shared/email-ui/` and 7 registered templates.
- PDF stack exists (`src/utils/pdfFonts.ts`, jsPDF with vendored Arabic/Hebrew fonts).
- No invoice system exists anywhere — invoice is genuinely new, not a rewrite.

## Work plan

### 1. Audit (Steps 1–8)
Walk the real flow end to end and report before changing anything: submit button → backend gate → status/history/events → admin submissions list → admin case detail → financial summary → case reference consistency. Fix only genuine production defects found (wrong totals, dead buttons, missing reference, wrong currency labels).

### 2. Invoice data (Steps 9–10)
Migration: `case_invoices` table (case_id, invoice_number `DRB-INV-YYYY-NNNNNN`, issued_at, currency, snapshot JSON of lines + totals, student name/email, status) with GRANTs, RLS (admin + assigned team read; student reads own), and an RPC `issue_case_invoice(p_case_id)` that builds the snapshot **from `get_case_financials`** — no second calculation anywhere. Re-issuing returns the existing invoice for the same case (idempotent). Because the invoice stores a snapshot and `case_services` already snapshots catalog prices, a later catalog price change cannot rewrite history; this gets re-tested live.

### 3. Invoice PDF + hosted page (Steps 11–12)
New `src/utils/invoicePdf.ts` reusing the existing Arabic-capable jsPDF font stack, and a `/invoice/:token` page rendering the same snapshot with a Download PDF button. Visual QA on a real generated PDF including a many-service case (page breaks, RTL, no NaN/null/₪ formatting bugs).

### 4. Invoice email (Steps 13–20)
New template `case-invoice.tsx` built from the existing `_shared/email-ui` components (same header/footer/buttons/colors as the invite and reminder emails), registered in `registry.ts`, sent through the existing `send-transactional-email` with an idempotency key `invoice-<invoice_number>` so retries never duplicate. Recipient is strictly the student email on the case; if missing/invalid the send is skipped and logged as a blocking issue for admin — never redirected. Deploy the functions, send a real email, verify sender/headers/links/mobile rendering and delivery in `email_send_log`. Deliverability: SPF/DKIM/DMARC live on the verified `support.darb.agency` delegation; I will report the authentication results I can actually observe and will not claim inbox placement I cannot see.

### 5. Submission trigger wiring (Steps 3–4, 23)
On successful submission the backend issues the invoice and enqueues the email; failures are logged and surfaced, and never block or corrupt the case or any money record.

### 6. Payment confirmation chain (Steps 21–28)
Verify confirm/reject, idempotency (double confirm rejected — already proven in Batch 6, re-verified here), actor/timestamp/case-history rows, notifications, and that payment confirmation does **not** jump the case to Enrolled. Fix labelling so admin sees "Payment confirmed — enrollment pending" with the next required action. Document commission behaviour at the boundary; implement none of the payout logic.

### 7. Security, legacy, exports (Steps 25, 30–31)
Prove team/partner/student cannot confirm payments or open admin review by direct URL or direct API call. Inventory legacy: `payments`/`commissions`/`services` tables are empty and `src/services/PaymentService.ts` is unused — document and remove only what is confirmed dead. Report missing fields future exports will need without building the export system.

### 8. E2E + report (Steps 32–33)
Full real run, then the exact Batch 7 report format you specified.

## Technical notes
- Everything financial reads `get_case_financials`; frontend totals are display-only.
- All schema changes go through tracked migrations with GRANT → RLS → policy order.
- Admin UI verification is done through authenticated RPC calls (the admin account's 2FA prompt still blocks browser-driven admin screenshots); this limitation is stated per step rather than glossed over.
