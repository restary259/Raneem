# Fix the "Refer & Register" flow end to end

## What I found (walked step by step, nothing changed)

```text
Step                         Result
1. Open /student/refer       Page loads, schools/insurance lists load
2. Pick a school             BROKEN - program/housing list fails ("catalog" error)
3. Submit registration       BROKEN - server step does not exist (404)
4. Invoice + email           BROKEN - never reached; invoice page can't read it anyway
5. Pay by bank transfer      BROKEN - "I've paid" button sends the wrong field name
6. Pay by card (Stripe)      BROKEN - server step not set up, no Stripe keys
```

Root cause: the database has an **older draft** of the referral migration, not the final version from PR #148 that the app code expects. The names of the values the app sends don't match what the database expects:

- Program catalog: the app sends a school, the database expects the referrer.
- Create registration: the app sends `p_data`, the database expects `p_payload`.
- Invoice lookup and bank-transfer submit: the app sends `p_token`, the database expects `p_public_token`.

Also:
- The three referral server functions (create registration, card checkout, card webhook) are **not deployed**.
- Stripe secret and webhook keys are not set, so card payments can't work yet.
- The bank details for registration payments are saved and ready.
- Zero registration invoices exist so far, so no real student was affected. One referral exists and is linked properly.

## Fix plan

1. **Bring the database up to the final version.** Give you a short, safe follow-up migration that recreates the five referral database functions with the final value names. It deletes no data and changes no tables. You deploy it manually, like before.
2. **Deploy the three referral server functions** so registration and the invoice email work.
3. **Harden the code against this happening again** (code only):
   - The invoice page currently hides lookup errors and shows "not found" instead. Make it show a real error, following the project rule that failed reads must look different from empty results.
   - The server's student check reads only one role per user. Make it accept users who have more than one role.
4. **Card payments:** keep the card button hidden or disabled with a clear "bank transfer only" message until you add Stripe keys. Then register the webhook.
5. **Verify:** sign in as student@gmail.com and submit a test referral. Check that the case, the invoice and the email status are created, open the public invoice, submit the bank transfer, and confirm it as admin. After that, delete the test records only if you approve.

## Technical details
- Live signatures: `get_registration_catalog(p_referrer_user_id)`, `create_student_referral_registration_internal(p_referrer_user_id, p_payload)`, `get_registration_invoice_by_token(p_public_token)`, `submit_registration_bank_transfer(p_public_token)`. Repo `20261001090000` uses `p_school_id` / `p_data` / `p_token`.
- New migration: `DROP FUNCTION IF EXISTS` the old signatures, then re-run the function bodies from `20261001090000` with a newer timestamp. Grants are the same as the original.
- Edge functions: `create-student-referral-registration`, `stripe-student-referral-checkout`, `stripe-student-referral-webhook`.
