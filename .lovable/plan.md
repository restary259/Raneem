# Apply page verification — result and one fix

## Verified working (checked in code + against the live backend)

- `/apply` route renders `ApplyPage` → shared `ApplyForm` (same form used by the partner and agent dashboards).
- Form validation: name + phone required, phone pattern check, bagrut English/Math units enforced before submit, consent required.
- Referral capture: `?ref=` is stored locally, verified, and kept on transient lookup failures (never silently stripped); the server resolves it again at submission.
- Edge function `create-case-from-apply` is deployed and responding:
  - honeypot request → `200 {"ok":true}` (bot silently discarded)
  - missing name/phone → `400 full_name and phone_number are required`
- Server-side attribution is intact: referral code resolved via `resolve_referral_code`; body-supplied `partner_id` only honoured for staff; logged-in partner/agent self-attribution from the JWT.
- Duplicate phone → case updated + attribution backfilled via `backfill_case_attribution`, returns `200 duplicate:true`, which the form treats as success.
- Lead mirroring RPC `insert_lead_from_apply` exists live; companions loop posts one case each.

## One real defect found

The function reads the student referral discount from a column that no longer exists:

```
platform_settings.referral_discount_amount   -> dropped (master-partner cleanup migration)
```

Live `platform_settings` now has `student_refer_friend_discount` / `student_refer_family_discount` instead. The select fails, `settings` comes back null, and the discount silently falls to ₪0 — so a student-to-student referral applicant never gets their discount on the new case. No error surfaces anywhere.

## Fix

In `supabase/functions/create-case-from-apply/index.ts`, replace the discount lookup with the type-aware one:

- Select `student_refer_friend_discount, student_refer_family_discount` from `platform_settings`.
- Pick the column by `normalizedReferralType` (`family` → family discount, otherwise friend discount).
- Keep the existing clamp: `0 … MAX_REFERRAL_DISCOUNT (₪500)`.
- Log the error if the settings read fails, instead of silently defaulting to 0.
- Redeploy the function.

No changes to attribution, commission, RLS, or the frontend form.
