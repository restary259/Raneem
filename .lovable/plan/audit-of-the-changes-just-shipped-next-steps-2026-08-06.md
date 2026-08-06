# Audit of the changes just shipped + next steps

## What is now live

Migration `20260806001221`:
- Anonymous EXECUTE revoked on `get_forgotten_cases`, `get_influencer_lead_ids`, `record_case_commission`, `log_activity`, `log_user_activity`, `request_payout`. `has_role` / `get_my_role` intentionally left public (RLS needs them).
- `cases` "Team can manage assigned cases" policy now has a `WITH CHECK` mirroring the `USING` clause.
- Self-service `payout_requests` INSERT and the rewards "restore on cancellation" policy dropped; new `cancel_payout_request(uuid)` SECURITY DEFINER function is the only cancel path.
- `case_payments` and `case_service_snapshots` got grants plus admin-manage / team-read policies.
- `record_case_commission` rewritten so only the partner actually linked to the case (`partner_id`, falling back to `referred_by`) is paid, instead of every row in `partner_commission_overrides`.

Client: `RewardsPanel.tsx` now calls `request_payout` and `cancel_payout_request` instead of writing `payout_requests` / `rewards` directly, so the ownership check, pending-status check, 20-day lock and duplicate-request guard actually run.

## Regression found in the shipped work (fix first)

**Team case reassignment is now broken.** `src/components/team/ReassignDialog.tsx:41` updates `cases.assigned_to` to another team member. The new `WITH CHECK (assigned_to = auth.uid())` rejects that row, so every reassign from the team dashboard will fail with a policy error. The `USING` clause passes (the case is currently theirs) but the post-image is not.

Two options, pick one:
- A: add a `reassign_case(p_case_id, p_new_assignee)` SECURITY DEFINER function that verifies the caller is the current assignee or an admin, checks the pre-submission status whitelist server-side, writes the audit row, and reassigns. Point `ReassignDialog` at it. Preferred — it also moves the status guard out of the client.
- B: make reassignment admin-only and drop the dialog from the team dashboard.

Verified clean: `TeamCasesPage.tsx:134` inserts with `assigned_to: user.id`, so case creation still passes. `get_influencer_lead_ids` has no client caller, so revoking `authenticated` there is safe.

## Next steps, in order

1. **Fix reassign (above).** Nothing else should ship before this — it is a live break in the team workflow.
2. **H6 — `PartnerPayoutsPanel` bulk payout.** `:362` still buckets `pending` and `approved` together and `:487` passes the whole union to the bulk confirm, so "Pay All Pending" marks already-requested rewards paid while the linked `payout_request` stays live and payable in `PayoutsManagement`, and no `transaction_log` row is written. Filter the bulk action to `status === 'pending'`, and make `totalPending` stop summing `approved`.
3. **`admin-mark-paid` revenue latch.** `admin-mark-paid/index.ts` sets `status = 'enrollment_paid'` first, which fires `auto_split_payment` synchronously off `case_submissions.service_fee`; the explicit `record_case_commission(total_payment_ils)` two statements later hits the `commission_split_done` guard and no-ops. The admin-entered amount is discarded and revenue can book as 0 permanently. Fix: call the RPC with the admin amount before the status flip, or drop the trigger and make the edge function the single caller.
4. **Edge-function auth (C2/C3/H1).** `send_welcome_email`, `send-branded-email`, `send-event-email`, `admin-weekly-digest` accept unauthenticated calls. Add JWT + role checks, then flip `verify_jwt` back on everywhere except the genuinely public endpoints: `create-case-from-apply`, `send-email`, `get-exchange-rate`, `ai-chat`, `auth-email-hook`, `auth-guard`. Before adding the check to `send-event-email`, confirm `app.settings.service_role_key` actually resolves — the `notify_visa_status_email` trigger depends on it.
5. **`auth-guard` deviceId (H4)** — undefined reference at `auth-guard/index.ts:124`.
6. **Cleanup pass** — M1 raw error messages, M4 dead files, M5 payout-panel consolidation around the three-actor model, M6 image compression.

## Technical notes

Migrations for step 1 and step 3 are separate; step 2 is client-only and can go in parallel. The reassign function should be granted to `authenticated` only and revoked from `anon`/`PUBLIC`, matching the pattern used for `cancel_payout_request`.
