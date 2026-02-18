
# Phase 6: Forensic Audit — Verified Findings & Targeted Fix Plan

## Audit Methodology

Every single claim in this 6-blocker forensic audit was verified against the live database schema, index definitions, trigger source code, and current data before designing any fix.

---

## BLOCKER-BY-BLOCKER VERDICT

### BLOCKER 1: Double-Click "Mark Paid" Creates Duplicate Commissions

**Audit Claim**: Double-click before first UPDATE returns creates two `auto_split_payment()` trigger firings → duplicate rewards.

**Verified Reality**: ✅ TRUE in theory — but already mitigated by the `rewards_user_case_unique` index.

```
Index: rewards_user_case_unique
WHERE admin_notes LIKE 'Auto-generated from case%'
ON (user_id, admin_notes)
```

The influencer reward INSERT will get blocked on second trigger firing. However, two gaps remain:
1. **Lawyer rewards are NOT covered**: The `admin_notes` pattern for lawyer rewards is `'Auto-generated lawyer commission from case%'` — which does NOT match the index filter `'Auto-generated from case%'` (verified by SQL: `lawyer_covered: false`). So a double-click CAN create two lawyer commission rewards.
2. **Client-side `setLoading(true)` guard**: Currently the `markAsPaid` function only sets a React loading state, which does not prevent a race condition if the component re-renders between two rapid taps.

**Live Data Check**: Current DB shows only 1 reward per case — no duplicates exist today.

**Database**: No `UNIQUE` constraint on `(id, case_status)` for `student_cases` — confirmed.

**Fix Required**: Two targeted changes:
1. Add `disabled={loading}` to the Mark Paid button (already present — it is there) plus extend the `rewards_user_case_unique` index to also cover the lawyer pattern.
2. Add `ON CONFLICT DO NOTHING` to the lawyer reward INSERT in `auto_split_payment()`.

---

### BLOCKER 2: auto_split_payment() Trigger Idempotency

**Audit Claim**: Rewards INSERT has NO idempotency, so double-trigger creates 2 rewards.

**Verified Reality**: ✅ PARTIALLY TRUE — with two sub-cases:
- **Influencer rewards**: Protected by `rewards_user_case_unique` index (pattern matches `'Auto-generated from case%'`). Second INSERT raises unique violation → silently ignored in practice OR causes error.
- **Lawyer rewards**: NOT protected (pattern `'Auto-generated lawyer commission from case%'` does not match index filter). Confirmed by SQL query.
- **Referral cashback**: NOT protected (pattern `'Auto-generated referral cashback'` does not match index).

**Live Evidence**: Current DB has one reward with `'Backfill: lawyer commission...'` (different pattern, manually inserted). No current duplicates.

**Fix**: Add `ON CONFLICT DO NOTHING` to lawyer and referral reward INSERTs in `auto_split_payment()`. The simplest approach is a migration that recreates `auto_split_payment()` with idempotency for all reward types.

---

### BLOCKER 3: Payout Request Can Reuse Same Reward IDs

**Audit Claim**: No constraint prevents the same `linked_reward_ids` appearing in two non-rejected payout requests simultaneously.

**Verified Reality**: ✅ TRUE — but the real protection is in the `eligibleRewards` client-side filter:

```typescript
const requestedRewardIds = new Set(
  payoutRequests.filter(p => p.status !== 'rejected')
    .flatMap((p: any) => p.linked_reward_ids || [])
);
const eligibleRewards = rewards.filter(r => {
  if (r.status !== 'pending') return false;
  if (requestedRewardIds.has(r.id)) return false;  // ← Already guards this
  ...
});
```

When a payout request is created, `submitPayoutRequest` also marks the rewards as `status: 'approved'`. Since `eligibleRewards` only includes `status === 'pending'` rewards, already-approved rewards cannot be re-requested client-side.

However, there is NO database-level enforcement. A user who directly calls the Supabase API (bypassing the React UI) could insert a payout_request with already-used reward IDs.

**Current DB State**: No duplicate payout request abuse found (0 payout_requests currently).

**Fix**: Add a database trigger or function that validates reward IDs are not already in a non-rejected request at INSERT time. This is done via an RPC function `request_payout` that wraps the INSERT with validation.

---

### BLOCKER 4: 20-Day Timer Enforced Client-Side Only

**Audit Claim**: `LOCK_DAYS = 20` is hardcoded client-side, no server validation.

**Verified Reality**: ✅ TRUE — the lock is calculated entirely in `EarningsPanel.tsx:71-72`:

```typescript
const days = Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
return days >= LOCK_DAYS;
```

The `submitPayoutRequest` function (lines 147-178) directly inserts into `payout_requests` with no server-side time validation. Anyone calling the Supabase API directly with a fresh reward ID would bypass this check.

**Fix**: Create a `request_payout` RPC function (SECURITY DEFINER) that validates the 20-day lock server-side before inserting the payout request. The client calls this RPC instead of inserting directly.

---

### BLOCKER 5: Lead source_id Is Mutable

**Audit Claim**: Admin can UPDATE `leads.source_id` to redirect commissions to a different person.

**Verified Reality**: ✅ TRUE — the `Admins can manage all leads` ALL policy has no column restriction. Admin CAN update `source_id`.

**However**: This is an internal admin action. Admins are already trusted — they control all case data, commissions, and financial decisions. Making `source_id` immutable would break legitimate admin workflows (e.g., correcting an incorrectly attributed lead).

**Risk Assessment**: Medium, not Critical — the threat model is a rogue admin, not an external attacker. The `admin_audit_log` already records all admin actions via `log_user_activity`.

**Fix**: Add a trigger that logs any `source_id` change to the audit log (rather than blocking it entirely). This creates an audit trail without breaking legitimate admin corrections.

---

### BLOCKER 6: Missing Influencer RLS on student_cases

**Audit Claim**: Influencers can see all cases because there's no RLS policy.

**Verified Reality**: ❌ FALSE — Already fixed in Phase 5. The policy exists:

```sql
Policy Name: "Influencers can view cases for their leads"
USING (has_role(auth.uid(), 'influencer'::app_role) AND EXISTS (
  SELECT 1 FROM leads l WHERE l.id = student_cases.lead_id AND l.source_id = auth.uid()
))
```

This is confirmed in the current RLS policy list in the database schema.

---

### ADDITIONAL FINDING: Commission Sum Exceeds Service Fee (Live Data)

**Verified from live DB query**:

```
Case 3a0362aa: service_fee=4000, total_commissions=7000 (influencer=2000 + lawyer=1000 + school=4000)
Case 8b5e542b: service_fee=4000, total_commissions=5000 (lawyer=1000 + school=4000)
```

Both cases show `total_commissions > service_fee` — meaning more is being paid out than the business collects. This is a **real live data issue** in the test data. The audit's claim about missing validation is confirmed.

**Fix**: Add a UI warning in `StudentCasesManagement.tsx` money tab when `total_commissions > service_fee` (a red alert). A DB CHECK constraint cannot be used here because commissions are legitimate business decisions (school commission can be paid by the school to Darb separately from the student fee). Instead, the UI should warn admins.

---

### ADDITIONAL FINDING: ReferralForm Checks Email But Not Phone

**Audit Claim**: Duplicate referrals by phone not blocked.

**Verified Reality**: ✅ TRUE — line 49 checks `referred_email` only. Since `insert_lead_from_apply` is called after, and leads have a phone unique index, the referral INSERT succeeds but the RPC will upsert (not error). The lead will be created/updated with the new referrer. This is a UX issue — the second referral record is created, but the lead gets reassigned to the new referrer_id.

**Fix**: Add a phone duplicate check in `ReferralForm` before submission.

---

## Summary: What Is Actually Real vs. False Alarms

| Blocker | Audit Status | Verified |
|---------|-------------|---------|
| Double-click mark_paid → duplicate rewards | Partial — influencer covered, lawyer/referral NOT | Fix lawyer pattern |
| Trigger idempotency | Partial — lawyer & referral rewards unprotected | Add ON CONFLICT |
| Reward ID reuse in payout | TRUE — no DB enforcement | Add RPC validation |
| 20-day timer client-side only | TRUE — no server check | Add RPC with validation |
| source_id mutable | TRUE but acceptable — admin trust level | Add audit log trigger |
| Missing influencer RLS | FALSE — already fixed in Phase 5 | No action |
| Commission > service_fee | TRUE — live data confirms | Add UI warning |
| Referral phone duplicate | TRUE — UX gap | Add phone check |

---

## Files and Migrations to Change

| Change | Type |
|--------|------|
| DB Migration: Extend `rewards_user_case_unique` to cover lawyer pattern + fix `auto_split_payment()` trigger | Migration |
| DB Migration: Create `request_payout` RPC that validates 20-day lock + reward ownership + no duplicate use | Migration |
| DB Migration: Add `trg_audit_source_id_change` trigger on leads for source_id changes | Migration |
| `src/components/influencer/EarningsPanel.tsx` | Code — call `request_payout` RPC instead of direct insert |
| `src/components/admin/StudentCasesManagement.tsx` | Code — add commission-over-fee warning in money tab |
| `src/components/dashboard/ReferralForm.tsx` | Code — add phone duplicate check before submission |

---

## Technical Details

### Migration 1: Fix trigger idempotency for lawyer & referral rewards

Recreate `auto_split_payment()` with `ON CONFLICT DO NOTHING` on all three reward INSERTs. First add a supporting unique index for lawyer rewards:

```sql
-- New partial index for lawyer rewards
CREATE UNIQUE INDEX IF NOT EXISTS rewards_lawyer_case_unique
  ON public.rewards (user_id, admin_notes)
  WHERE admin_notes IS NOT NULL 
    AND admin_notes LIKE 'Auto-generated lawyer commission from case%';

-- Then update trigger: add ON CONFLICT DO NOTHING to lawyer INSERT
INSERT INTO rewards (user_id, amount, status, admin_notes)
VALUES (NEW.assigned_lawyer_id, NEW.lawyer_commission, 'pending',
        'Auto-generated lawyer commission from case ' || NEW.id::text)
ON CONFLICT DO NOTHING;  -- ← Add this
```

### Migration 2: `request_payout` RPC with server-side validation

```sql
CREATE OR REPLACE FUNCTION public.request_payout(
  p_reward_ids uuid[],
  p_amount numeric,
  p_notes text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_requestor_role text DEFAULT 'influencer',
  p_student_names text[] DEFAULT '{}'
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_ineligible_count integer;
  v_already_requested_count integer;
  v_not_owned_count integer;
  v_new_id uuid;
BEGIN
  -- 1. All rewards must belong to caller
  SELECT COUNT(*) INTO v_not_owned_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND user_id != auth.uid();
  IF v_not_owned_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards do not belong to you';
  END IF;

  -- 2. All rewards must be status='pending'
  SELECT COUNT(*) INTO v_ineligible_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND status != 'pending';
  IF v_ineligible_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are not in pending status';
  END IF;

  -- 3. 20-day lock check
  SELECT COUNT(*) INTO v_ineligible_count
  FROM rewards WHERE id = ANY(p_reward_ids)
    AND (NOW() - created_at) < INTERVAL '20 days';
  IF v_ineligible_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are still within the 20-day lock period';
  END IF;

  -- 4. No reward already in an active (non-rejected) payout request
  SELECT COUNT(*) INTO v_already_requested_count
  FROM payout_requests
  WHERE status NOT IN ('rejected')
    AND linked_reward_ids && p_reward_ids;
  IF v_already_requested_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are already in a pending payout request';
  END IF;

  -- 5. Insert payout request
  INSERT INTO payout_requests (requestor_id, requestor_role, linked_reward_ids, 
                               linked_student_names, amount, admin_notes, payment_method)
  VALUES (auth.uid(), p_requestor_role, p_reward_ids, p_student_names,
          p_amount, p_notes, p_payment_method)
  RETURNING id INTO v_new_id;

  -- 6. Mark rewards as approved
  UPDATE rewards SET status = 'approved', payout_requested_at = NOW()
  WHERE id = ANY(p_reward_ids);

  RETURN v_new_id;
END;
$$;
```

### Code: EarningsPanel calls RPC instead of direct INSERT

```typescript
// Replace the direct insert in submitPayoutRequest with:
const { data: newId, error: rpcError } = await (supabase as any).rpc('request_payout', {
  p_reward_ids: eligibleRewards.map(r => r.id),
  p_amount: availableAmount,
  p_notes: requestNotes || null,
  p_payment_method: `Bank: ${profile?.bank_name} / Branch: ${profile?.bank_branch} / Account: ${profile?.bank_account_number}`,
  p_requestor_role: role,
  p_student_names: studentNames,
});
if (rpcError) {
  toast({ variant: 'destructive', title: 'Error', description: rpcError.message });
  return;
}
// No need to separately UPDATE rewards — the RPC does it atomically
```

### Code: Commission warning in money tab

```typescript
// In StudentCasesManagement money tab:
const totalCommissions = (selectedCase.influencer_commission || 0) + 
                         (selectedCase.lawyer_commission || 0) + 
                         (selectedCase.school_commission || 0);
const isOverBudget = totalCommissions > (selectedCase.service_fee || 0);

{isOverBudget && (
  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
    ⚠️ Total commissions ({totalCommissions} ₪) exceed service fee ({selectedCase.service_fee} ₪)
  </div>
)}
```

### Code: ReferralForm phone duplicate check

```typescript
// Add before setIsLoading(true):
const { data: existingByPhone } = await (supabase as any)
  .from('referrals')
  .select('id')
  .eq('referred_phone', form.phone)
  .eq('referrer_id', userId);
if (existingByPhone?.length) {
  toast({ variant: 'destructive', title: t('referrals.duplicateError') });
  return;
}
```

---

## What Does NOT Change

- No change to RLS policies — already complete and correct (influencer student_cases policy already added in Phase 5)
- No making `source_id` immutable — admin trust is legitimate
- No commission ceiling constraint — school commissions are separate revenue streams
- All UI layouts, business logic, and existing workflows unchanged
