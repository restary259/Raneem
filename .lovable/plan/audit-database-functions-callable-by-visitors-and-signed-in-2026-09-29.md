# Audit: database functions callable by visitors and signed-in users

The scanner warnings are about privileged database actions that anyone signed in (and in 9 cases, any visitor) is allowed to call. Being callable is not a hole by itself — each action must check who is calling inside. The audit confirms that check exists for every one.

## Scope (confirmed live)

- 9 actions any visitor can call: check_referral_code, get_invitation_preview, get_invoice_by_token, insert_lead_from_apply, record_partner_click, resolve_partner_link, resolve_recruit_code, resolve_referral_code, submit_recruit_application.
- ~170 actions any signed-in user can call (payments, commissions, payouts, chat, calls, case stages, directories).

## Steps

1. **Visitor actions (highest priority)** — read each definition; confirm it only returns non-private data (no email/phone/IBAN), needs an unguessable token where relevant, validates input, and cannot be used to flood or enumerate. Fix any that fail.
2. **Signed-in actions** — for each, classify:
   - A. Has a proper caller check (admin/role/ownership via auth.uid()) — keep.
   - B. Internal helper only used by triggers/policies/other functions (e.g. helpers not called from the app) — remove the signed-in permission.
   - C. Called by the app but missing a check — add the check.
   Classification uses the app code to see which actions the app actually calls.
3. **Fix** in one database change: revoke category B permissions, add checks for category C, tighten any visitor action that fails step 1. Nothing the app calls legitimately loses access.
4. **Verify** — rerun the scanner, recount warnings, run the test suite, and spot-check apply form, invoice link, invitation page, and a partner referral link still work.
5. **Report** — a plain list: kept (with reason), locked down, fixed; remaining warnings explained as accepted.

## Technical details

- Source: pg_proc where prosecdef and EXECUTE granted to anon/authenticated; bodies via pg_get_functiondef.
- Caller map: rg `.rpc("name"` across src/ and supabase/functions/ (service-role callers don't need the authenticated grant).
- Category B: REVOKE EXECUTE ... FROM anon, authenticated, PUBLIC; keep service_role.
- Category C: add has_role()/auth.uid() guard at the top, RAISE on failure.
- Money/stage guards (record_case_commission, enforce_case_stage_transition, etc.) untouched in logic.
- Manual-deploy migration, idempotent.
