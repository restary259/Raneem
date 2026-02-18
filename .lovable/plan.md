
# Stage 1 Critical Fixes — 4 Blockers Before Operations

## Issue Analysis

### Issue 1: Apply Page Submit — Does Nothing
The apply page code (`ApplyPage.tsx`) looks **correct** — `handleSubmit` calls `supabase.rpc('insert_lead_from_apply', ...)` and on success sets `submitted = true`. The bug is likely **not the RPC call itself** but the success screen behavior:

- The success screen currently only shows a "Explore Website" button — **no WhatsApp redirect** as required
- The `canGoNext()` check on step 4 always returns `true`, so the Submit button is enabled — but `loading` state correctly prevents double submission
- The main issue to fix: **WhatsApp community redirect is missing** from the success screen

For the "Add Someone Else" fields: companions only collect `name`, `phone`, and `education` — they are missing `passport_type` which the main applicant has. The companion RPC call omits `p_passport_type`, `p_english_units`, `p_math_units` — so eligibility score is always 0 for companions.

### Issue 2: Financial Logic — Wrong Net Profit Warning
**Found the exact bug:** In `StudentCasesManagement.tsx` lines 240-251:
```typescript
const totalComm = (selectedCase.influencer_commission || 0) 
                + (selectedCase.lawyer_commission || 0) 
                + (selectedCase.school_commission || 0);  // ← BUG: adds EUR to NIS
```
The `school_commission` is in EUR (€) but is being added to NIS commissions and compared to the NIS `service_fee`. This makes the warning fire incorrectly (e.g., 2000 NIS commissions + 4000 EUR school commission = 6000 > 4000 NIS service fee).

**Fix:** Remove `school_commission` from the commission comparison entirely. The warning must only compare NIS-denominated payouts vs NIS service fee. Better yet, **remove the warning entirely** as requested — it's conceptually wrong because School Commission is revenue, not an expense.

**Net Profit formula** in `getNetProfit()` (line 88):
```typescript
const getNetProfit = (c) => (c.service_fee || 0) + (c.school_commission || 0) 
  - (c.influencer_commission || 0) - (c.lawyer_commission || 0) 
  - (c.referral_discount || 0) - (c.translation_fee || 0);
```
This mixes EUR school commission into NIS profit. The correct formula:
```
Net Profit (₪) = service_fee - influencer_commission - lawyer_commission - referral_discount - translation_fee
School commission (€) is shown separately, not subtracted from NIS net profit
```

### Issue 3: Agents Appearing in Team Member Dropdown
**Found the exact code** in `LeadsManagement.tsx` lines 586-588:
```tsx
{lawyers.map(l => <SelectItem ...>{l.full_name} (Team)</SelectItem>)}
{influencers.map(i => <SelectItem ...>{i.full_name} (Agent)</SelectItem>)}
```
The `influencers` array is being rendered in the same dropdown as `lawyers`. The fix is simple: **remove the influencers mapping from this Select entirely.** The dropdown for case assignment should only show team members (lawyers).

### Issue 4: Runtime Crash — `a.catch is not a function`
The console logs show repeated `TypeError: a.catch is not a function` originating from `EarningsPanel-3sGMVXYP.js`. The root cause is in `EarningsPanel.tsx` line 41:
```typescript
const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));
```
Supabase's `PostgrestFilterBuilder` (what `.from().select()...` returns) is **not a native Promise** — it's a thenable. Calling `.catch()` on it directly can fail in certain bundler/runtime contexts. The `PullToRefresh` component also triggers document event handlers that try to call `.catch` on non-promise values.

**Fix:** Change `safeQuery` to properly await the query:
```typescript
const safeQuery = async (queryBuilder: any) => {
  try {
    const result = await queryBuilder;
    return result;
  } catch (err) {
    return { data: null, error: err };
  }
};
```

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ApplyPage.tsx` | Add WhatsApp redirect on success screen; fix companion data to include passport/unit fields |
| `src/components/admin/StudentCasesManagement.tsx` | Remove the commission-vs-service-fee warning; fix `getNetProfit` to exclude school commission (EUR) |
| `src/components/admin/LeadsManagement.tsx` | Remove influencers from the team member assignment dropdown |
| `src/components/influencer/EarningsPanel.tsx` | Fix `safeQuery` to properly handle Supabase querbuilder (not Promise) |

## Detailed Changes

### 1. `ApplyPage.tsx` — Success Screen + WhatsApp Redirect

After `setSubmitted(true)`, trigger WhatsApp redirect:
```typescript
const handleSubmit = async () => {
  // ... existing RPC call ...
  setSubmitted(true);
  // Redirect to WhatsApp after short delay
  setTimeout(() => {
    window.open('https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo', '_blank');
  }, 1500);
};
```

Update the success screen to include a WhatsApp join button:
```tsx
<a href="https://chat.whatsapp.com/J2njR5IJZj9JxLxV7GqxNo" target="_blank" rel="noopener noreferrer">
  <Button className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white text-base font-semibold">
    💬 {isAr ? 'انضم لمجموعة واتساب' : 'Join WhatsApp Group'}
  </Button>
</a>
```

### 2. `StudentCasesManagement.tsx` — Fix Financial Display

Remove the warning block entirely (lines 239-251).

Fix `getNetProfit` (line 88) — exclude school commission (it's EUR revenue, not NIS expense):
```typescript
const getNetProfit = (c: any) => 
  (c.service_fee || 0) 
  - (c.influencer_commission || 0) 
  - (c.lawyer_commission || 0) 
  - (c.referral_discount || 0) 
  - (c.translation_fee || 0);
// School commission stays separate as EUR revenue
```

The MoneyDashboard's `kpis` calculation (`MoneyDashboard.tsx` line 114) already correctly separates NIS and EUR — no change needed there.

### 3. `LeadsManagement.tsx` — Team Member Dropdown Only

Lines 586-588: Remove the influencer rows from the Select:
```tsx
<SelectContent>
  {lawyers.map(l => (
    <SelectItem key={l.id} value={l.id}>
      {l.full_name}
    </SelectItem>
  ))}
</SelectContent>
```
Also update the empty-state condition from `lawyers.length === 0 && influencers.length === 0` to `lawyers.length === 0`.

### 4. `EarningsPanel.tsx` — Fix `safeQuery` Promise Handling

Replace `safeQuery` (line 41):
```typescript
// BEFORE (broken):
const safeQuery = (p: Promise<any>) => p.catch(err => ({ data: null, error: err }));

// AFTER (correct):
const safeQuery = async (queryBuilder: any): Promise<{ data: any; error: any }> => {
  try {
    const result = await queryBuilder;
    return result;
  } catch (err) {
    return { data: null, error: err };
  }
};
```

## No Database Changes Required

All four fixes are pure frontend/UI changes. The database schema, RLS policies, and edge functions are correct for these issues.

## Summary

| # | Issue | Root Cause | Fix Complexity |
|---|-------|------------|----------------|
| 1 | Apply submit — WhatsApp missing | Success screen has no redirect | Simple: add button + setTimeout redirect |
| 2 | Net profit wrong; bad warning | School commission (EUR) mixed into NIS math | Simple: remove warning, fix formula |
| 3 | Agents in team dropdown | Influencers rendered in lawyer Select | Simple: remove 1 line |
| 4 | `a.catch` crash in EarningsPanel | Supabase builder not a native Promise | Simple: wrap in try/await |
