# Finish fixing "Refer & Register"

## What I found after your update
The database is **unchanged**. It still has the early draft. The update ran without errors, but the referral SQL I pasted to you earlier in this chat was itself the **draft version**, not the final one. The cleanup ran, then that SQL put the same draft back. That was my mistake.

Result: picking a program, creating the registration, opening the invoice and "I've paid by bank transfer" are all still broken. The server steps are live and ready; only the database is out of date.

## Plan
1. **Apply the correct update myself** instead of pasting it again. The file is too large to paste reliably, which is how the wrong version slipped through. I'll apply the saved repair file (`20261001120000_repair_student_referral_registration.sql`) exactly as it is, through the approval card. It removes the draft's leftovers (the card-payment table is empty, and the update stops on its own if it isn't), then installs the final version. It deletes no other data.
2. **Confirm it landed:** check that the database expects the inputs the app sends.
3. **Walk the full flow as student@gmail.com:** open Refer, pick a school, program and housing, submit a test friend registration, check that the case and invoice were created and what the email status says, open the public invoice link, then press "I've paid by bank transfer". After that I confirm the payment as admin and check that the case advances.
4. **Report** each step as passed or failed, then fix whatever still breaks.
5. **Clean up:** delete the test case, invoice and payment only if you say so.

## Not included
- Card payments stay off until you add Stripe keys. That's a separate setup step I'll walk you through when you want it.

## Technical details
- The live database still expects the draft inputs (`p_payload`, `p_public_token`, the catalog keyed by referrer, a payments table with `registration_invoice_id`). The app code sends `p_data`, `p_token` and `p_school_id`.
- Apply the repair file through the migration tool, byte for byte.
