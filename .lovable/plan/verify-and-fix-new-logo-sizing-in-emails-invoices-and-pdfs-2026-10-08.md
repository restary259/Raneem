# Verify and fix new logo sizing in emails, invoices and PDFs

## What I found
- The new wordmark file is 1774 x 887 (2:1) with large empty margins (actual artwork is about 1584 x 535 on the dark version).
- **Invoice PDFs** (`invoicePdf.ts`, `registrationInvoicePdf.ts`) draw the logo at 34 x 12.9 mm (2.64:1) — the new logo is squashed/stretched.
- **App emails** (`src/lib/email-templates/_ui`) use the new wordmark at 132px wide, auto height — proportions are fine, but empty margins make the visible logo small, and the file is 620 KB (slow in inboxes).
- **Backend emails** (`supabase/functions/_shared/email-ui/theme.ts`) still point to the OLD logo.
- **Invoice web page** (`InvoicePage.tsx`) uses w-32/w-36 auto height — correct ratio, but small due to margins.

## Changes
1. Make trimmed, email-sized copies of the dark and white wordmarks (margins cropped, ~600px wide, compressed PNG) and upload them as new assets. Originals are kept.
2. Emails (both copies of the email theme): point to the trimmed dark wordmark, width 160px, height auto. Backend email functions need redeploying after the change.
3. Invoice PDFs: use the trimmed logo and compute height from the real aspect ratio (width 40 mm, centred) so it is never distorted.
4. Invoice web page: switch to the trimmed logo; keep current width classes.
5. Check the theme/component email tests still pass; add a test asserting the PDF logo height matches the image ratio.

## Verification
- Render an email preview and an invoice PDF, screenshot both, confirm logo is sharp, centred and not stretched, on mobile and desktop widths, Arabic and English.
