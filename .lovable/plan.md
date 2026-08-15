# Migration-to-Code Reconciliation — verified findings and fix plan

I re-checked every "critical" item from the audit against the live database before planning. Most of them are already resolved; three real issues remain.

## Verified against the live database (no action needed)

- Ambassador visibility (R-01/A-01): the pool function already accepts ambassadors — the migration is applied live.
- Payout directory functions (DUP-01): all four directory functions exist live, so the duplicate-timestamp file was applied.
- Historical revenue overstatement (FIN-01/C-02): zero cases have both a completed commission split and a referral discount — there is nothing to correct.
- Duplicate profile emails (F-05): zero duplicates today.
- Rewards typing: the `reward_type` column exists and is populated.

So the "must fix now" list in the audit is largely already fixed in this project. What is still real:

## What actually needs fixing

### 1. Admin financial KPI undercounts commissions (confirmed with live rows)
The admin overview classifies rewards by matching the free-text note prefix. Live data contains agent self-referral rewards whose note starts with "Agent self-referral…", so they are counted in neither the partner nor team bucket. Result: partner-pool outlay is understated and platform net revenue is overstated on the admin dashboard.

Fix: classify by the structured `reward_type` / `recipient_role` columns instead of note prefixes, keeping the note match only as a fallback for legacy rows. File: `src/services/DashboardService.ts`.

### 2. Payment-proof uploads can't precede a payment row
`case_payment_proofs.payment_id` is `NOT NULL` live, but the upload flow expects it to be optional (a Germany-side proof can arrive before any payment row exists). Fix with a migration that drops the NOT NULL and re-points the uploader foreign key so deletes behave sanely.

### 3. Admin dashboard fetches two dead tables
`influencer_invites` and `commissions` are legacy and empty; the admin dashboard still loads them. Replace the invites fetch with `user_invitations` and drop the `commissions` fetch (and its field) so nothing renders phantom sources. File: `src/integrations/supabase/dataService.ts`, plus the consumers of those two fields.

## Cleanup (low risk, same pass)

- `src/types/database.ts` is handwritten and stale: `Appointment.lawyer_id` (real column is `team_member_id`), `Commission` and the legacy commission fields on `StudentCase`, and `Reward` missing `reward_type` / `recipient_role` / `case_id` / `unlock_at` / `source_user_id`. Update the interfaces that are still used and delete the ones tied to removed tables.
- Rename the duplicate-timestamp migration filenames so future `db push` runs are unambiguous. All of them are already applied, so this is hygiene only — no SQL re-runs.
- Add a deprecation comment on `referrals.discount_applied` (never written; discount comes from the case row).

## Not doing

- No changes to commission calculation, the pool split, case status transitions, attribution, or any RLS policy — all verified correct.
- No historical data corrections: the diagnostic returned zero affected rows.
- No enum surgery for the unused `moderator` / `user` role values (Postgres can't remove them; harmless).

## Technical notes

- One migration: `ALTER TABLE public.case_payment_proofs ALTER COLUMN payment_id DROP NOT NULL;` plus recreating `case_payment_proofs_uploaded_by_fkey`, and the deprecation comment.
- KPI classification helper stays inside `DashboardService.financialOverview()`; the per-case reconstruction fallback keeps working for legacy cases with no recorded service fee.
- Verification: `npm run build` and the full vitest suite, then re-check the admin financial overview numbers against a direct rewards sum.
