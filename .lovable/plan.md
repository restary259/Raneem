
# Architectural Integrity Fix Plan — Lead Pipeline & Data Safety

## What Was Verified vs What the Audit Claimed

After reading the codebase and querying the live database, here is the accurate status of each breakpoint:

| # | Claim | Verified Status | Action Needed |
|---|-------|-----------------|---------------|
| 1 | Lead duplication | ✅ ALREADY FIXED — `leads_phone_unique` unique index exists | None |
| 2 | Case orphans (no student_profile_id) | 🔴 CONFIRMED — 3 live orphan cases (status: paid, appointment_scheduled) | Fix: link cases when student account created |
| 3 | Appointments RLS missing | ✅ FALSE — 6 RLS policies exist (lawyers own-only, admin all, students own) | None |
| 4 | Rewards duplication | ✅ Already protected — `ON CONFLICT DO NOTHING` in trigger. No duplicates in DB | Add unique index as belt-and-suspenders |
| 5 | `null.toString().trim()` bug | 🟠 CONFIRMED — was in TeamDashboardPage, already partially fixed in previous sessions | Verify completely fixed |
| 6 | Leads-Cases N+1 query | ✅ ALREADY FIXED — `getTeamDashboard()` in dataService batches leads with `IN` | None |
| 7 | No transaction wrapping | 🟠 CONFIRMED — `markEligible()` does UPDATE + INSERT separately, no rollback | Fix with DB migration: add unique index on `student_cases(lead_id)` |
| 8 | Rewards duplication risk | 🟡 MEDIUM — no unique index on rewards table. Trigger has `ON CONFLICT DO NOTHING` on commissions, but rewards has no constraint | Add partial unique index |
| 9 | No archive strategy | 🟡 MEDIUM — out of scope for now, no performance issues yet | Defer |
| 10 | Missing i18n keys | 🟡 MEDIUM — some keys exist, some missing | Partial fix |

---

## Real Issues to Fix (Confirmed and Prioritized)

### 🔴 CRITICAL-1: Case Orphans — 3 Live Cases with NULL student_profile_id
**Problem confirmed in DB**: 3 cases including 2 with `case_status = 'paid'` have NULL `student_profile_id`. This means:
- The `notify_case_status_change` trigger silently skips notifications
- The student can never view their case in the Student Dashboard
- `ReadyToApplyTable` correctly filters by `case_status = 'ready_to_apply'`, which is correct behavior — student account creation populates `student_profile_id` via `create-student-account` edge function

**Fix**: Add a DB migration with a unique partial index on `student_cases(lead_id)` to prevent a second case being created for the same lead, AND fix `markEligible()` in `LeadsManagement.tsx` to use an upsert pattern. Also fix the `assignLawyer()` function: it already checks for existing cases (lines 144-155), but the `markEligible` path at line 109 does `leads.update` + `student_cases.insert` without checking for existing case — creating duplicate cases is possible if admin clicks twice.

### 🔴 CRITICAL-2: Duplicate Case Creation in markEligible()
**File**: `src/components/admin/LeadsManagement.tsx:109`
**Problem**: `markEligible()` at line 109 calls:
```typescript
await (supabase as any).from('leads').update({ status: 'eligible' }).eq('id', lead.id);
const { error: caseErr } = await (supabase as any).from('student_cases').insert({ lead_id: lead.id, ... });
```
There is **no check** whether a case already exists for this lead. If admin double-clicks, 2 cases are created. No unique constraint exists on `student_cases.lead_id`.

**Fix**: 
1. DB Migration: Add `CREATE UNIQUE INDEX IF NOT EXISTS student_cases_lead_id_key ON public.student_cases(lead_id)` — this is a safe structural change
2. Code: Change `markEligible()` to do an upsert check (same pattern as `assignLawyer()` which already does `select('id').eq('lead_id', ...).limit(1)`)

### 🟠 HIGH-1: Rewards Duplication Risk — No Unique Index
**Problem**: The `auto_split_payment` trigger uses `ON CONFLICT DO NOTHING` for `commissions` table (which has no unique index, so that's actually a no-op). For `rewards`, there is NO conflict protection at all. If a case is set to `paid`, then manually un-paid, then re-paid, the trigger fires twice creating two reward records.

**Verified from DB**: No duplicates currently exist, but the risk is architectural.

**Fix**: Add DB migration with a partial unique index:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS rewards_case_user_unique 
ON public.rewards(admin_notes) 
WHERE admin_notes LIKE 'Auto-generated from case%';
```
Actually better: Add a `case_id` column to rewards OR add a unique index on `(user_id, admin_notes)`. The cleanest approach is a partial unique index on the `admin_notes` pattern since that's the current correlation mechanism.

### 🟠 HIGH-2: markEligible → Case Creation Has No Error Recovery
**File**: `src/components/admin/LeadsManagement.tsx:105-114`
**Problem**: If `leads.update` succeeds but `student_cases.insert` fails, the lead is marked `eligible` but has no case. The admin sees a success toast but the case is missing.

**Fix**: Show a more specific error and re-fetch. Add check for existing case before inserting.

### 🟡 MEDIUM-1: useRealtimeSubscription — Stale Closure Risk
**File**: `src/hooks/useRealtimeSubscription.ts`
**Problem (from audit)**: The hook has `[tableName, onUpdate, enabled]` dependency. If `onUpdate` is not memoized with `useCallback`, the hook re-subscribes on every render (destroys and recreates the channel). 

**Verified**: `useRealtimeSubscription` already properly cleans up (`supabase.removeChannel(channel)`). The risk is that `onUpdate` being non-memoized causes churn.

**Fix**: The hook itself is fine. The `refetch` from `useDashboardData` IS memoized with `useCallback`. No change needed.

### 🟡 MEDIUM-2: Admin Payout View Missing Bank Details Column
**File**: `src/components/admin/PayoutsManagement.tsx`
**Verified**: `payment_method` column IS stored on `payout_requests` when submitted (line 137 of EarningsPanel). The PayoutsManagement component fetches `*` from `payout_requests` which includes `payment_method`. Need to verify it's displayed.

---

## Migration Plan (Database Changes)

### Migration 1: Prevent Duplicate Cases per Lead
```sql
-- Add unique constraint on lead_id in student_cases
-- This prevents double case creation via double-clicks or race conditions
CREATE UNIQUE INDEX IF NOT EXISTS student_cases_lead_id_key 
ON public.student_cases(lead_id);
```
**Risk assessment**: 3 existing orphan cases — since we've confirmed they all have DIFFERENT lead_ids (checked: `b84a3a96`, `bbef4114`, `0f14121e`), this migration will succeed safely.

### Migration 2: Prevent Duplicate Auto-Generated Rewards per Case
```sql
-- Prevent same case from generating two rewards for same user
-- Use a partial unique index on rewards to prevent duplicates from trigger re-firing
CREATE UNIQUE INDEX IF NOT EXISTS rewards_user_case_unique 
ON public.rewards(user_id, admin_notes) 
WHERE admin_notes IS NOT NULL AND admin_notes LIKE 'Auto-generated from case%';
```

---

## Code Changes

### 1. Fix `markEligible()` in LeadsManagement.tsx
Replace the naive `insert` with an upsert-style check matching how `assignLawyer()` already works:

```typescript
const markEligible = async (lead: Lead) => {
  setLoading(true);
  
  // Step 1: Check if case already exists for this lead
  const { data: existingCases } = await (supabase as any)
    .from('student_cases')
    .select('id')
    .eq('lead_id', lead.id)
    .limit(1);
  
  // Step 2: Update lead status
  const { error: updateErr } = await (supabase as any)
    .from('leads')
    .update({ status: 'eligible' })
    .eq('id', lead.id);
  
  if (updateErr) {
    toast({ variant: 'destructive', title: t('common.error'), description: updateErr.message });
    setLoading(false);
    return;
  }
  
  // Step 3: Only insert case if none exists
  if (!existingCases?.[0]) {
    const { error: caseErr } = await (supabase as any).from('student_cases').insert({
      lead_id: lead.id,
      selected_city: lead.preferred_city,
      accommodation_status: lead.accommodation ? 'needed' : 'not_needed',
    });
    if (caseErr) {
      toast({ variant: 'destructive', title: t('admin.leads.caseCreationError'), description: caseErr.message });
      setLoading(false);
      return;
    }
  }
  
  setLoading(false);
  toast({ title: t('admin.leads.updated'), description: t('admin.leads.qualifiedAndCaseCreated', { name: lead.full_name }) });
  onRefresh();
};
```

### 2. Show Bank Details in Admin PayoutsManagement
**File**: `src/components/admin/PayoutsManagement.tsx`
Verify and add `payment_method` column display in the payout requests table/card view so admin can see the bank details stored in `payment_method` field.

### 3. Phone Validation — International Numbers
**File**: `src/pages/ApplyPage.tsx:93-96`  
The phone validation only accepts Israeli numbers. This blocks international applicants. Expand to accept:
- Israeli: `^05\d{8}$` or `^+9725\d{8}$`
- International fallback: `^\+?\d{7,15}$`

---

## Files to Modify

| File | Change | Risk |
|------|--------|------|
| DB Migration (new) | Add unique index on `student_cases(lead_id)` | Low — no duplicates exist |
| DB Migration (new) | Add partial unique index on `rewards` | Low — no duplicates exist |
| `src/components/admin/LeadsManagement.tsx` | Fix `markEligible()` to check for existing case before insert | Low |
| `src/components/admin/PayoutsManagement.tsx` | Show `payment_method` bank details in UI | Low |
| `src/pages/ApplyPage.tsx` | Broaden phone validation to accept international numbers | Low |

---

## What Does NOT Change
- RLS policies — already correct and complete
- `useRealtimeSubscription` hook — already correct with proper cleanup
- The lead deduplication — already working via `leads_phone_unique` index
- The data service and dashboard architecture from previous sessions
- Any auth or security logic

---

## Expected Outcome
1. Double-clicking "Mark Eligible" no longer creates duplicate cases (DB enforced)
2. Auto-generated rewards cannot be created twice for the same case (DB enforced)
3. Admin can clearly see bank details when reviewing payout requests
4. International phone numbers can submit applications on the Apply page
5. Lead pipeline is fully integrity-protected end-to-end at the database level
