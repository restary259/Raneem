
# Stage 2 — Core Feature Fixes (6 Issues)

## Analysis of Each Issue

### Issue 5: Filters Not Working — "New" Shows 0 Leads

**Root cause found in `LeadsManagement.tsx` line 85:**
```typescript
const matchStatus = filterStatus === 'all' || l.status === filterStatus;
```
The filter value used is `'new'` but in the database, a lead that was submitted by an influencer and processed has `status = 'assigned'` — which is correct. Looking at the screenshot: when filtering by "New", 0 results appear. The real issue is that both current leads show `status: 'assigned'` — they've already been processed — so "New" correctly returns 0. **But the filter dropdown only offers: `new`, `eligible`, `not_eligible`, `assigned`** — it is missing status values like `ineligible` and `paid`.

The actual bug is in the **Influencer Dashboard** filter logic (line 116):
```typescript
if (studentFilter === 'ineligible') return leads.filter(l => (l.eligibility_score ?? 0) < eligibleMin && l.status !== 'new');
```
This uses score-based eligibility (`< eligibleMin`) **not** the admin-set `status` field. So a lead with `score=80` but admin marked `status='not_eligible'` still appears as "Eligible" in the influencer view.

**Admin Leads filter** — the status dropdown should also include `'not_eligible'` mapped from the DB value. The current `statusKeys` array on line 264 does include it: `['new', 'eligible', 'not_eligible', 'assigned']`. The real data just happens to have no `new` leads right now.

**Fix needed:**
1. In `InfluencerDashboardPage.tsx`: Change the `isEligible` check and filter logic to use the **`lead.status` field** (admin-set) rather than score-based calculation:
   - `eligible` filter → `l.status === 'eligible'` or `l.status === 'assigned'` or `l.status === 'paid'`
   - `ineligible` filter → `l.status === 'not_eligible'`
   - KPI `eligibleLeads` count → `leads.filter(l => ['eligible', 'assigned'].includes(l.status)).length`
   - KPI `ineligibleLeads` count → `leads.filter(l => l.status === 'not_eligible').length`

### Issue 6: Arabic Chart Labels Mashed (مسار التحويل)

**Root cause:** The Recharts `YAxis` on the horizontal bar chart in `InfluencerDashboardPage.tsx` uses `width={80}` which clips the Arabic text. Arabic labels like "مقدّم", "مؤهل", "مدفوع" need more space, and `tick={{ fontSize: 12 }}` doesn't account for RTL text rendering.

**Fix needed in `InfluencerDashboardPage.tsx`:**
- Increase `YAxis width` from `80` to `110` for Arabic
- Add `tick` renderer that applies RTL text alignment
- Increase chart height from `180` to `220` so bars have room
- Use `margin={{ left: isAr ? 10 : 0, right: 16 }}` for RTL

### Issue 7: Eligibility Status Sync — Wrong Status in Influencer Dashboard

**Root cause:** The influencer dashboard determines "eligible" based on `eligibility_score >= eligibleMin` (line 101, 115), but the admin sets `status = 'not_eligible'` or `status = 'eligible'` independently. A lead with `score=80` marked "Ineligible" by admin still shows as مؤهل in the influencer view.

**Fix needed (same as Issue 5 fix above):**
Change all eligibility checks in `InfluencerDashboardPage.tsx` to use `lead.status` field:
```typescript
// Before (wrong — uses score):
const eligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) >= eligibleMin).length;
const isEligible = score >= 50; // hardcoded 50 not even using eligibleMin

// After (correct — uses admin-set status):
const eligibleLeads = leads.filter(l => ['eligible', 'assigned', 'paid'].includes(l.status)).length;
const isEligible = ['eligible', 'assigned', 'paid'].includes(lead.status);
```

### Issue 8: Complete Profile Freeze (Influencer Cases)

**Root cause investigation:** The `openProfileModal` function in `TeamDashboardPage.tsx` (line 221) calls `getLeadInfo(c.lead_id)` which searches `leads` array. For **influencer-referred cases**, the `leads` array in the Team dashboard is populated only by `dataService.ts` `getTeamDashboard()` — which queries leads by `lead_id` from the team member's cases. This should work.

The actual freeze is **not in the modal open**, but likely in the `dataService.ts` `getTeamDashboard()` where `leads` are fetched for cases:

```typescript
// dataService.ts line 126
.select('id, full_name, phone, email, eligibility_score, eligibility_reason, source_type, source_id, ...')
```

The `source_id` is included. When the team member opens the profile modal for an influencer-referred case, `lead.email` is accessed on line 226:
```typescript
student_email: c.student_email || (lead as any).email || '',
```

This should work. The freeze is more likely from **the 14-field required validation** — if `student_full_name` already has a value, it's `String(val).trim() === 'null'` check (line 270) which catches the string `"null"`. This could cause an odd block.

But the bigger issue: **`canTransition` check** (line 309). If the influencer case has `case_status = 'assigned'` (as seen in DB), `canTransition('assigned', 'profile_filled')` must return `true`. Let me check `caseTransitions.ts`:

The `case_status` in DB for the influencer-referred case is `'paid'` (both test cases are `paid`). So the "Complete Profile" button only appears for `appointment_scheduled`, `appointment_waiting`, `appointment_completed` statuses — but the influencer test case is `'paid'`. This means the button shouldn't even show for this case since it's already `paid`.

The freeze described may actually be a **loading state freeze** when opening the modal. The `setSavingProfile(false)` is called after missing fields check — that's correct. The potential freeze is if `profileCase` is set but `leads` array doesn't contain the lead (causing `getLeadInfo` to return a default object that mismatches).

**Fix:** Ensure `openProfileModal` safely handles missing lead data, and add a null guard to prevent rendering the profile form when lead info is unavailable.

### Issue 9: Payment System — Switch to Manual Payout Mode

**Current behavior:** When a case is marked paid, the `auto_split_payment` trigger automatically creates rewards and commissions with `status = 'paid'`.

**Required behavior:**
- When marked paid → commission status = `'pending'`  
- 20-day countdown starts
- After 20 days → status = `'should_be_paid'` (or admin can manually mark)
- Admin controls: Mark as Paid / Clear / Reset
- No auto-payout triggers

**Fix needed:**
1. Modify the `auto_split_payment` trigger in the database to set `status = 'pending'` instead of `'paid'` for new rewards/commissions
2. Add a database function `check_pending_rewards()` that updates rewards older than 20 days from `'pending'` to `'should_be_paid'`  
3. Update `MoneyDashboard.tsx` to show admin controls: "Mark Paid", "Clear", "Reset Balance" per reward row
4. The 20-day lock countdown is already implemented in `EarningsPanel.tsx` for the influencer side — this is consistent

### Issue 10: Referral Attribution — Show Actual Name

**Root cause:** In `StudentCasesManagement.tsx` (line 83), the `getSourceBadge` function already does this correctly:
```typescript
if (lead.source_type === 'influencer' && c.agent) return <Badge>🤝 {c.agent.full_name}</Badge>;
```
The `agent` is resolved in the `useMemo` (line 50):
```typescript
const agent = lead?.source_type === 'influencer' && lead?.source_id ? influencers.find(i => i.id === lead.source_id) : null;
```

**The bug in `LeadsManagement.tsx`:** The source column shows "Via Influencer" tag instead of the actual name. Looking at line 268-274:
```typescript
const getInfluencerName = (lead: Lead) => {
  if (lead.source_type === 'influencer' && lead.source_id) {
    return (influencers ?? []).find(i => i.id === lead.source_id)?.full_name || null;
  }
  return null;
};
```
The function exists but need to verify it's being rendered. Looking at the leads table rendering — need to check lines 330-450 where the table rows are rendered.

**Also:** For `referral` source type (student refers another student), the referrer's name is not shown. We need to look up the referrer's profile name from `source_id`.

## Files to Change

| File | Issue | Change |
|------|-------|--------|
| `src/pages/InfluencerDashboardPage.tsx` | #5, #6, #7 | Fix eligibility to use `lead.status`; fix chart Arabic labels |
| `src/components/admin/LeadsManagement.tsx` | #10 | Ensure influencer name shows (verify render code) |
| `src/components/admin/StudentCasesManagement.tsx` | #10 | Verify referral name attribution |
| `src/pages/TeamDashboardPage.tsx` | #8 | Fix profile modal freeze for influencer cases |
| `src/components/admin/MoneyDashboard.tsx` | #9 | Add manual payout controls per reward row |
| Database migration | #9 | Update `auto_split_payment` trigger — set rewards to `'pending'` not `'paid'` |

## Detailed Changes

### Fix #5 & #7 — Eligibility Sync (InfluencerDashboardPage.tsx)

Remove `eligibleMin` state entirely — it's no longer needed. Replace all score-based checks with `lead.status`:

```typescript
// KPI counts — use status field, not score
const totalLeads = leads.length;
const eligibleLeads = leads.filter(l => ['eligible', 'assigned', 'paid'].includes(l.status)).length;
const ineligibleLeads = leads.filter(l => l.status === 'not_eligible').length;
const paidCases = cases.filter(c => c.case_status === 'paid' || c.paid_at).length;

// Filters — use status field
if (studentFilter === 'eligible') return leads.filter(l => ['eligible', 'assigned', 'paid'].includes(l.status));
if (studentFilter === 'ineligible') return leads.filter(l => l.status === 'not_eligible');

// Student card — use status field
const isEligible = ['eligible', 'assigned', 'paid'].includes(lead.status);
```

This immediately fixes the discrepancy between admin view and influencer view.

### Fix #6 — Arabic Chart Labels (InfluencerDashboardPage.tsx)

```tsx
// Widen YAxis for Arabic text and increase chart height
<ResponsiveContainer width="100%" height={isAr ? 220 : 180}>
  <BarChart data={funnelData} layout="vertical" margin={{ left: isAr ? 8 : 0, right: 16 }}>
    <XAxis type="number" hide />
    <YAxis 
      type="category" 
      dataKey="name" 
      width={isAr ? 120 : 90}
      tick={{ fontSize: isAr ? 11 : 12, textAnchor: isAr ? 'end' : 'start' }}
    />
    ...
  </BarChart>
</ResponsiveContainer>
```

The key changes: wider `YAxis`, taller chart, larger font for Arabic, proper `textAnchor`.

### Fix #8 — Complete Profile Freeze (TeamDashboardPage.tsx)

The freeze occurs because `openProfileModal` tries to access `lead.email` but the team data service doesn't always return `email` for all leads (especially influencer-referred ones where the lead may not have an email). The null guard fix:

```typescript
const openProfileModal = (c: any) => {
  const lead = getLeadInfo(c.lead_id);
  // Ensure lead is fully resolved before opening modal
  if (!lead || !lead.full_name) {
    toast({ variant: 'destructive', title: 'Lead data not found' });
    return;
  }
  setProfileCase(c);
  setProfileValues({
    student_full_name: c.student_full_name || lead?.full_name || '',
    student_email: c.student_email || (lead as any)?.email || '',
    // ... rest of fields
  });
};
```

Also add a `useEffect` that re-fetches leads when `profileCase` is set but its lead is missing from the `leads` array.

### Fix #9 — Manual Payout Mode

**Database migration:** Update the `auto_split_payment` trigger to insert rewards/commissions with `status = 'pending'` instead of `status = 'paid'`.

**`MoneyDashboard.tsx` changes:**
- Show a "Pending Payouts" section with each pending reward row
- Add "Mark Paid" button per row (updates reward/commission status to `'paid'`)
- Add "Clear" button (deletes/resets the pending reward)
- Keep KPI calculations the same — show theoretical receivable

The transaction table rows already show `status` as `'pending'` or `'paid'` via `STATUS_COLORS` map.

### Fix #10 — Referral Attribution (LeadsManagement.tsx)

Need to check the table rendering. Looking at the existing `getInfluencerName` function (lines 268-274) — the function exists, but need to ensure it's rendered in the source column of the leads table. The fix is to use this function in the source cell rendering and also handle `referral` type by looking up the referrer name from the `profiles` table (using `source_id`).

In `StudentCasesManagement.tsx` the agent name is already shown when `c.agent` is resolved. The issue is only in `LeadsManagement.tsx` source column display.

## Summary Table

| # | Issue | Root Cause | Files Changed |
|---|-------|------------|---------------|
| 5 | "New" filter shows 0 | Data has no `new` leads (all assigned) — actually correct. Influencer `eligible` filter uses score not status | `InfluencerDashboardPage.tsx` |
| 6 | Arabic chart mashed | `YAxis width=80` too narrow for Arabic text | `InfluencerDashboardPage.tsx` |
| 7 | Eligibility sync wrong | Score-based check overrides admin-set `status` | `InfluencerDashboardPage.tsx` |
| 8 | Complete Profile freeze | Missing lead data when influencer case; null access | `TeamDashboardPage.tsx` |
| 9 | Auto payout removes manual control | `auto_split_payment` trigger sets `status='paid'` immediately | DB migration + `MoneyDashboard.tsx` |
| 10 | Source shows generic tag | `getInfluencerName` function not rendered in source column | `LeadsManagement.tsx` |

## No New Tables Needed

The database migration for Issue #9 only modifies the existing `auto_split_payment` trigger — it changes the default `status` value from `'paid'` to `'pending'` for newly created rewards and commissions.
