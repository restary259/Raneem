
# Complete RPC & Security Scan — Findings & Fix Plan

This is a full audit of the RPC layer, database functions, frontend calls, authentication, financial logic, and UI consistency across the DARB platform. All findings are based on direct code inspection and live database queries.

---

## Audit Summary

The platform has **3 categories of issues**: functional bugs (broken or missing behavior), security gaps (data exposure, missing validation), and financial logic inconsistencies.

---

## Section 1 — RPC Function Audit

### Functions Identified

| RPC / DB Function | Caller | Auth Required | Risk Level |
|---|---|---|---|
| `insert_lead_from_apply` | Contact form, Apply page | ❌ Public (anon) | Medium |
| `validate_influencer_ref` | Apply page | ❌ Public (anon) | Low |
| `request_payout` | EarningsPanel | ✅ Authenticated | Medium |
| `log_user_activity` | Admin actions | ✅ Authenticated | Low |
| `get_lawyer_lead_ids` | RLS helper | Internal | Low |
| `get_influencer_lead_ids` | RLS helper | Internal | Low |
| `upsert_lead_from_contact` | (Legacy — unused) | ❌ Public | Medium |

### Finding 1 — `insert_lead_from_apply` is SECURITY DEFINER (correct) but accepts `p_source_id` from the client

**Issue**: The Apply page passes `p_source_id: sourceId` directly from the client. An attacker can pass any UUID as `p_source_id` to falsely attribute leads to any influencer, boosting that influencer's stats and triggering commission payments.

**Current code (ApplyPage.tsx line 137)**:
```typescript
p_source_id: sourceId,  // This comes from localStorage or URL param — attacker-controlled
```

**The RPC does NOT validate that `p_source_id` belongs to a real influencer**. The `validate_influencer_ref` function IS called on the frontend to verify the ref, but:
1. The frontend validation result is stored in React state (`sourceType`, `sourceId`) — both are mutable from the browser console
2. Nothing on the server validates that the submitted `p_source_id` actually corresponds to an influencer with a valid role before creating the lead

**Fix**: In `insert_lead_from_apply`, add server-side validation:
```sql
-- At the start of the RPC, validate source_id
IF p_source_type = 'influencer' AND p_source_id IS NOT NULL THEN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_source_id AND role = 'influencer'
  ) THEN
    -- Silently downgrade to organic rather than throwing — prevents enumeration
    p_source_type := 'organic';
    p_source_id := NULL;
  END IF;
END IF;
```

**File**: DB migration to update `insert_lead_from_apply` function.

---

### Finding 2 — `insert_lead_from_apply` Accepts Arbitrary `p_source_type` Values

**Issue**: The function accepts any string for `p_source_type`. Valid values are `'organic'`, `'influencer'`, `'referral'`, `'contact_form'`. But nothing stops a user from submitting `p_source_type: 'admin'` or any arbitrary string.

**Fix**: Add validation at the top of the RPC:
```sql
IF p_source_type NOT IN ('organic', 'influencer', 'referral', 'contact_form') THEN
  p_source_type := 'organic';
END IF;
```

---

### Finding 3 — `request_payout` RPC — Correct Server-Side Guards ✅

The `request_payout` RPC correctly enforces:
- Reward ownership (must belong to `auth.uid()`)
- Status must be `'pending'`
- 20-day lock period enforced server-side
- No duplicate payout requests

**No fix needed.** This is the gold standard implementation.

---

### Finding 4 — `upsert_lead_from_contact` is a Stale Duplicate RPC

The function `upsert_lead_from_contact` exists in the DB but is NOT called anywhere in the current codebase (Contact form now uses `insert_lead_from_apply`). This is dead code that adds attack surface.

**Fix**: Drop this function via migration.
```sql
DROP FUNCTION IF EXISTS public.upsert_lead_from_contact(text, text, text, text, text, text);
```

---

### Finding 5 — Legacy Overload of `insert_lead_from_apply` (without companion params) Still Exists

The DB has 3 overloaded versions of `insert_lead_from_apply`. Only the version with `p_companion_name/phone/preferred_major` should be kept. The old shorter overloads may be accidentally called by TypeScript's `as any` override.

**Fix**: Drop the 2 legacy overloads, keep only the current full signature.

---

## Section 2 — Input Validation Gaps

### Finding 6 — Contact Form: `interestedMajor` NOT Passed to RPC

**Critical bug found**: Contact.tsx collects `interestedMajor` from the form (line 27) but the RPC call on line 45-50 does **NOT include it**:
```typescript
// Missing: p_preferred_major: values.interestedMajor
const { error } = await supabase.rpc('insert_lead_from_apply', {
  p_full_name: values.name, p_phone: values.phone, p_city: values.city,
  p_education_level: values.educationLevel, p_german_level: 'beginner',
  // ← interestedMajor field collected but never sent!
});
```

This means the admin never sees what major the contact form lead was interested in. **Fix**: Add `p_preferred_major: values.interestedMajor` to the RPC call.

---

### Finding 7 — Phone Validation: Contact Form Accepts Any 9+ Digit String

The contact form's phone validation is only `z.string().trim().min(9)` — it accepts phone numbers like `"123456789"` which are not real Israeli/German numbers.

ApplyPage.tsx has much stronger phone validation (`isValidPhone` function with regex). The contact form should use the same regex.

**Fix**: Replace `z.string().trim().min(9, ...)` with:
```typescript
phone: z.string().trim().regex(/^(05\d{8}|\+9725\d{8}|\+?\d{7,15})$/, {
  message: 'Invalid phone number format'
}),
```

---

### Finding 8 — No Rate Limiting on RPC Calls from Apply Page

`insert_lead_from_apply` is callable by anonymous users with no rate limiting from the database side. The Supabase edge rate limiter is the only protection. An attacker can spam the form to create thousands of fake leads.

**Fix**: Add a client-side honeypot (already done in Contact form ✅) to Apply page. Also add server-side rate limiting in the RPC using a simple approach:
```sql
-- In insert_lead_from_apply, check for too many leads from same phone in last 24h
-- The upsert-on-phone approach already handles this (same phone = update, not insert)
-- The real risk is many different phone numbers → current architecture can't block this at RPC level
-- Mitigation: Supabase rate limits + honeypot on form (already done)
```
**No DB change needed** — the phone-based upsert naturally deduplicates, and honeypot is in place.

---

## Section 3 — Authentication & Authorization Issues

### Finding 9 — `MoneyDashboard` Updates `rewards` and `payout_requests` Directly Without Server Validation

In `MoneyDashboard.tsx` lines 70-91 and 239-255, the admin marks rewards and payout requests as paid via direct `.update()` calls:
```typescript
await (supabase as any).from('rewards').update({ status: 'paid', paid_at: ... }).eq('id', rewardId);
await (supabase as any).from('payout_requests').update({ status: 'paid', paid_at: ... }).eq('id', req.id);
```

This is **fine** because RLS on `rewards` and `payout_requests` allows admin ALL access (`has_role(auth.uid(), 'admin')`). The admin role is enforced at the database level. ✅

However, there is **no audit logging** when an admin marks a reward as paid. This is a compliance gap.

**Fix**: After marking paid, insert into `admin_audit_log`:
```typescript
await supabase.from('admin_audit_log').insert({
  admin_id: session.user.id,
  action: 'mark_reward_paid',
  target_id: rewardId,
  target_table: 'rewards',
  details: `Manually marked reward ${rewardId} as paid`,
});
```

---

### Finding 10 — `EarningsPanel` cancels payout requests with direct UPDATE

**Code at line 195**:
```typescript
await (supabase as any).from('payout_requests')
  .update({ status: 'rejected', reject_reason: 'Cancelled by user' })
  .eq('id', reqId);
```

RLS policy: "Users can cancel own pending payout requests" — `auth.uid() = requestor_id AND status = 'pending'`. This correctly prevents users from cancelling others' requests and non-pending requests. ✅

**BUT**: After cancellation, the code restores rewards to `pending` via a loop (line 197-199):
```typescript
for (const rid of req.linked_reward_ids) {
  await (supabase as any).from('rewards').update({ status: 'pending', payout_requested_at: null }).eq('id', rid);
}
```

**RLS on rewards** only allows users to `SELECT` own rewards — there is **no UPDATE policy** for non-admin users on the `rewards` table! Looking at the RLS schema:
- `Admins can update all rewards` ✅
- `Users can view own rewards` ✅
- **Missing: Users can update own rewards' status when payout is cancelled**

This means when a non-admin influencer tries to cancel a payout request, the reward restoration fails silently (RLS blocks the update). The influencer would then be stuck — their rewards show as `'approved'` but the payout request is cancelled.

**Fix**: Add an RLS policy:
```sql
CREATE POLICY "Users can restore own rewards on cancellation"
ON public.rewards FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'approved')
WITH CHECK (auth.uid() = user_id AND status = 'pending');
```

**Or better**: Move the cancellation logic to a server-side RPC `cancel_payout_request(p_request_id uuid)` that atomically handles both the request update and the reward restoration.

---

### Finding 11 — `dataService.ts` Fetches ALL Rewards and Commissions (No Pagination)

**Line 184-185**:
```typescript
safeQuery((supabase as any).from('commissions').select('*')),
safeQuery((supabase as any).from('rewards').select('*')),
```

Supabase default limit is 1000 rows. With many students, this will silently truncate results, causing the Money Dashboard to show incorrect totals.

**Fix**: Add explicit `.limit(2000)` or implement pagination for these tables. The commissions and rewards tables should be queried with `.order('created_at', { ascending: false }).limit(2000)`.

---

## Section 4 — Financial Logic Issues

### Finding 12 — Money Dashboard KPI Mixes Accounting Periods

The `kpis` calculation (line 136-158) filters by `c.paid_at` but the `transactions` memo (line 96) uses `READY_STATUSES` which includes cases that are NOT paid (`'ready_to_apply'`, `'registration_submitted'`, `'visa_stage'`, `'settled'`). These cases may not have `paid_at` set.

**Result**: KPI shows revenue only from cases with `paid_at`, but the transactions table shows those cases PLUS ones in other statuses. This creates a discrepancy between the KPI numbers and the transaction list.

**Fix**: Make the transaction list consistent with the KPI — only show cases where `c.paid_at` is not null OR where `c.case_status === 'paid' || c.case_status === 'completed'`.

```typescript
const MONEY_STATUSES = ['paid', 'completed', 'visa_stage', 'registration_submitted', 'ready_to_apply'];
const paidCases = cases.filter(c => c.paid_at || MONEY_STATUSES.includes(c.case_status));
```

---

### Finding 13 — School Commission is EUR but Net Profit Calculation Shows Total in NIS Only

This is **by design** (per the architecture note: "School Commission (€) is EUR revenue and must not be mixed into NIS profit calculations"). The current code correctly separates them. ✅

**However**: The `totalExpensesNIS` on line 147 includes `totalInfluencerComm + totalLawyerComm + totalReferralDiscount + totalTranslation` but the commissions table also has amounts. The `commissions` table is fetched but never used in the KPI calculations — there may be a double-counting risk if both `cases.influencer_commission` and `commissions.influencer_amount` are tracked separately.

**Fix (documentation)**: Clarify in code that commissions from the `commissions` table are NOT used in KPI calculations to avoid future double-counting bugs. The single source of truth for financial KPIs is `student_cases`.

---

### Finding 14 — Service Fee Default of 8,000 NIS Already Fixed ✅

`StudentCasesManagement.tsx` line 267: `service_fee: Number(selectedCase.service_fee) || 8000` — correctly defaults to 8000 NIS.

---

## Section 5 — Data Exposure Issues

### Finding 15 — `dataService.ts` (influencer query) fetches phone from leads

**Line 38**:
```typescript
.select('id, full_name, phone, eligibility_score, eligibility_reason, status, source_type, created_at, preferred_city, preferred_major, accommodation, ref_code, last_contacted')
.eq('source_id', userId)
```

Influencers CAN see the `phone` of their referred leads. The architecture notes say not to expose this. This is partially intentional (they need to contact leads) but the RLS policy allows it. This should be a deliberate decision.

**Assessment**: If influencers are supposed to contact their own leads directly, phone exposure is intentional. If not, the SELECT should remove `phone`. Leave as architectural decision for the admin to decide — **document it**.

---

### Finding 16 — `leads.email` exposed to Team Dashboard via dataService

**Line 126**:
```typescript
.select('id, full_name, phone, email, eligibility_score, ...')
```

The email IS included in the team member's lead fetch. This is correct because team members need to contact students. RLS correctly restricts this to only the lawyer's assigned cases. ✅

---

## Section 6 — Contact Form Bug

### Finding 17 — Contact Form `interestedMajor` Value Is Collected But Never Submitted (Confirmed)

This is confirmed from line 44-51 in Contact.tsx. The `values.interestedMajor` field is in the form schema and collected, but the RPC call does not pass `p_preferred_major`. This means leads from the contact form always have `preferred_major = null`.

---

## Summary of All Fixes

### Priority 1 — Security (Immediate)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1 | `p_source_id` not validated server-side in RPC | DB migration | Add `user_roles` check in `insert_lead_from_apply` |
| 2 | `p_source_type` accepts arbitrary strings | DB migration | Whitelist valid values in RPC |
| 10 | Influencer reward restoration blocked by RLS | DB migration | Add UPDATE policy for own rewards on cancellation |

### Priority 2 — Functional Bugs

| # | Issue | File | Fix |
|---|-------|------|-----|
| 6 | `interestedMajor` not passed from Contact form to RPC | `Contact.tsx` | Add `p_preferred_major: values.interestedMajor` |
| 7 | Weak phone validation on Contact form | `Contact.tsx` | Add regex validation matching ApplyPage |
| 9 | No audit log when admin marks reward as paid | `MoneyDashboard.tsx` | Insert to `admin_audit_log` after mutations |
| 11 | rewards/commissions fetch may silently truncate | `dataService.ts` | Add `.limit(2000)` |
| 12 | Transactions vs KPI status mismatch | `MoneyDashboard.tsx` | Unify filter to `paid_at`-based |

### Priority 3 — Cleanup

| # | Issue | File | Fix |
|---|-------|------|-----|
| 4 | Dead `upsert_lead_from_contact` RPC | DB migration | DROP FUNCTION |
| 5 | Legacy overloads of `insert_lead_from_apply` | DB migration | DROP old overloads |

---

## Files to Change

| File | Changes |
|------|---------|
| DB Migration | Fix `insert_lead_from_apply` with source validation; drop dead functions; add RLS policy for reward restoration |
| `src/components/landing/Contact.tsx` | Add `p_preferred_major: values.interestedMajor` to RPC call; stronger phone regex |
| `src/components/admin/MoneyDashboard.tsx` | Add audit log on mark-paid; fix KPI/transaction filter mismatch |
| `src/integrations/supabase/dataService.ts` | Add `.limit(2000)` to rewards and commissions queries |

---

## What Is Already Correct (No Changes Needed)

- `request_payout` RPC: Full server-side validation ✅
- `auto_split_payment` trigger: Sets rewards to `pending` (already fixed) ✅
- RLS on all tables: Admin-only mutation policies ✅
- JWT validation in edge functions: `getClaims(token)` pattern used ✅
- Service fee default 8000 NIS: Already in place ✅
- WhatsApp redirect after apply/contact: Already in place ✅
- Influencer filter exemption in fraud detection: Already fixed in Stage 2 ✅
- `validate_influencer_ref`: SECURITY DEFINER, reads from user_roles only ✅
- Phone-based upsert: Prevents duplicate leads from same phone naturally ✅
- IBAN validation: MOD-97 checksum implemented ✅

