# Fix "column note does not exist" on payment proof uploads

## Why you still see it
I checked the database just now. None of the last fix has been applied yet:
- The "note" field is still missing from payment proofs.
- The "is this my case?" helper doesn't exist.
- Tsukuyomi's account still has no link to Kheir.

The page code is already updated. Only the database part is left.

## What to do
Run this file in full, in the same place you ran the invoice permission:
`docs/manual-sql/20261004150000_payment_proofs_and_invited_students.sql`

If you only want to clear this error first, this one line is enough:

```sql
ALTER TABLE public.case_payment_proofs ADD COLUMN IF NOT EXISTS note text;
```

The full file also:
- lets students see their own proofs, which the checkmark and Documents list need
- links invited students to the team member who invited them, so Tsukuyomi shows in Kheir's Students tab

## After you run it, I will
1. Confirm in the database that the field, helper and Kheir link are there.
2. Sign in as Tsukuyomi, upload a test PDF, and confirm the green check and the "Payment proofs" list on the Documents page.
3. Sign in as Kheir and confirm Tsukuyomi appears in Students and his proof shows on the case.

No code changes are planned; this is just the database step and the checks.
