
## Root Cause

The `create-case-from-apply` edge function tries to INSERT into the `cases` table using `discount_amount` — but that column **does not exist**. The real column is `referral_discount`. This causes a PostgreSQL error on every new (non-duplicate) submission, resulting in a 500 that crashes the frontend.

The Contact form has a second issue: it only sends `full_name`, `phone_number`, and `source` to the edge function — it does not forward `city`, `education_level`, `passport_type`, `english_units`, `math_units`, or `degree_interest`, so those enriched fields are never saved.

## Two-Part Fix

**1. Edge function — fix the wrong column name**

In `supabase/functions/create-case-from-apply/index.ts`, line 185:

```
// WRONG:
discount_amount: referral_discount ? Number(referral_discount) : 0,

// CORRECT:
referral_discount: referral_discount ? Number(referral_discount) : 0,
```

**2. Contact form — forward all enriched fields to the edge function**

In `src/components/landing/Contact.tsx`, expand the body sent to `create-case-from-apply` to include all the fields the user fills in:

```typescript
body: JSON.stringify({
  full_name: fullName.trim(),
  phone_number: phone.trim(),
  source: 'contact_form',
  city: city.trim() || null,
  education_level: educationLevel || null,
  passport_type: passportType || null,
  english_units: englishUnits ? parseInt(englishUnits) : null,
  math_units: mathUnits ? parseInt(mathUnits) : null,
  degree_interest: preferredMajor.trim() || null,
}),
```

## Files Changed

- `supabase/functions/create-case-from-apply/index.ts` — fix `discount_amount` → `referral_discount`
- `src/components/landing/Contact.tsx` — pass all form fields to the edge function

No database migrations needed. The edge function will be redeployed automatically.
