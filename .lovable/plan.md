# Admin early payout release for team members

Give admins a way, from the Admin dashboard only, to pay a team member's commissions immediately instead of waiting out the 20-day lock.

## How it works for you

In Admin → Payouts → **Team** tab, open a team member's profile. A new **Locked rewards (early release)** card lists every still-locked reward for that member with case reference, student name, amount and its unlock date, each with a checkbox.

- Tick the rewards you want to release, see a running total.
- Click **Release & pay now**.
- Confirm your admin password (same gate used for visa edits), add a required note (reason).
- The selected rewards are marked paid instantly and a payout record with status "paid" appears in that member's history, tagged as an early release with your note.

The card only appears for team members. Partners, ambassadors, agents and students keep the normal request → approve → pay flow with the 20-day lock untouched.

## Technical details

**Database (new migration, manual apply as usual)**

1. `get_member_locked_rewards(p_member_id uuid)` — SECURITY DEFINER, admin-only (`has_role(auth.uid(),'admin')`), returns the member's locked rewards (`status='pending'` and `unlock_at > now()`): `reward_id, amount, case_id, case_reference, student_name, reward_type, created_at, unlock_at`.
2. `admin_early_release_rewards(p_member_id uuid, p_reward_ids uuid[], p_note text)` — SECURITY DEFINER, admin-only:
   - Verifies the target holds the `team_member` role (raises otherwise) — early release is a team-only privilege.
   - Locks rows (`FOR UPDATE`), validates every id belongs to the member and is still `pending`; ignores/raises on already-paid ids so a double click is a no-op (idempotent).
   - Sets `unlock_at = now()`, `status='paid'`, `paid_at = now()` on the selected rewards.
   - Inserts one `payout_requests` row: `requestor_id = member`, `requestor_role='team_member'`, `linked_reward_ids`, summed `amount`, `status='paid'`, `requested_at/approved_at/paid_at = now()`, `approved_by/paid_by = auth.uid()`, `admin_notes` = "Early release: <note>", plus `payout_reference` via the existing assign trigger. It does **not** create a pending row, so the `uniq_pending_payout_per_requestor` index is unaffected.
   - Writes an `admin_audit_log` entry (`action = 'team_early_payout_release'`, reward ids, total, note).
   - Returns `{released_count, total_amount, payout_request_id}`.
   - `REVOKE ALL FROM anon`; `GRANT EXECUTE TO authenticated` (admin gate inside), matching the repo's RPC-first pattern.

Commission math, `record_case_commission`, the 20-day default and every other role's flow are untouched — this only moves the unlock forward for explicitly selected rewards.

**Frontend**

- `src/hooks/useEarlyRelease.ts` — loads locked rewards via the RPC, calls the release RPC, toasts, exposes `refetch`.
- `src/components/admin/TeamEarlyReleaseCard.tsx` — checkbox list + total + "Release & pay now" button; wraps the action in the existing `AdminPasswordConfirm` gate followed by a confirm dialog with a required note textarea. Disabled while empty/submitting.
- `src/components/admin/RequesterProfilePanel.tsx` — render the card only when `role === 'team_member'`; call `onRefresh()` after a successful release so KPIs and history update.
- New i18n keys under `admin.payouts.earlyRelease.*` added to both `en` and `ar` `dashboard.json` (parity guard).
- Generated `src/integrations/supabase/types.ts` gets the two new RPC signatures.

**Verification**: `npm run build` and `npx vitest run` (i18n parity guard included) must be green.
