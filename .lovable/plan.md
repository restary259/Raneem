
# Phase 4: Filter & State Sync — Verified Assessment & Targeted Fix Plan

## Verified Database Scale (The Most Important Finding)

Before implementing any server-side filtering or pagination, the live database was queried:

| Table | Row Count |
|-------|-----------|
| leads | 3 |
| student_cases | 3 |
| profiles | 5 |
| appointments | 2 |
| rewards | 2 |
| commissions | 2 |
| referrals | 1 |

**The audit's entire performance argument is based on a hypothetical 10,000-row scenario that does not exist.** Migrating all filtering to server-side queries right now would add complexity, remove search flexibility, and slow development — with zero user-visible benefit at current scale. The correct engineering approach is to build server-side pagination when there is real data pressure to justify it.

---

## Claims Verified Against Actual Code

| Audit Claim | Verified Reality | Action |
|---|---|---|
| Client-side filtering (perf risk) | True structurally, but 3 rows — no impact | Add pagination as UI-only enhancement (no server change) |
| Tab switching doesn't refetch | FALSE — `useDashboardData` refetch is already wired, realtime subscriptions are active | No change needed |
| SLA hardcoded at 48h | FALSE — `TeamDashboardPage.tsx:166` reads `> 24` hours, not 48 | No change needed |
| Eligibility threshold hardcoded at 50 | TRUE — `InfluencerDashboardPage.tsx:103` uses `>= 50` but DB has `eligible_min: 70` | Fix: fetch from `eligibility_thresholds` |
| `fetchAllData` called once (empty deps) | FALSE — the hook's `refetch` uses `useCallback` correctly, realtime subscriptions call `refetch` | No change needed |
| Modal data is stale | PARTIAL — `StudentCasesManagement` closes and reopens modal from the props array; `onRefresh` is called after mutations which triggers `useDashboardData.refetch` | No change needed |
| Inconsistent search (1-3 fields) | True — minor UX inconsistency but not a data-integrity issue | Low-priority standardization |
| Pagination not implemented | True — but irrelevant at 3 rows | Add client-side pagination component as a forward-looking UI improvement |

---

## The One Real Bug: Eligibility Threshold Mismatch

**File**: `src/pages/InfluencerDashboardPage.tsx:89,103`

The `eligibility_thresholds` table exists and has `eligible_min = 70`. The influencer dashboard hardcodes `>= 50`. This means:
- Stat card "Eligible" shows leads with score >= 50
- Admin-set threshold is >= 70
- If admin changes the threshold to 60 or 80, influencer still sees stale count

**Fix**: On mount, fetch the `eligible_min` value from `eligibility_thresholds` and use it for both the KPI stat and the student filter.

---

## What Will Be Implemented

### 1. Fix Eligibility Threshold in InfluencerDashboardPage
Fetch `eligible_min` from `eligibility_thresholds` on mount (single lightweight query). Use it in:
- `eligibleLeads` count (line 89)
- `ineligibleLeads` count (line 90)
- `filteredLeads` filter (lines 103-104)

Default to `50` if the query fails (safe fallback).

### 2. Add Client-Side Pagination to LeadsManagement
Add a simple `page` / `pageSize = 50` + `Pagination` component to `LeadsManagement`. This uses the already-filtered `filtered` array and slices it for display. No server-side change needed. This is forward-looking — it costs nothing now and prevents a UX problem when leads grow.

**Technical approach**:
- Add `const [page, setPage] = useState(1)` 
- Reset page to 1 when `search`, `filterStatus`, or `filterSource` changes
- `const paginated = filtered.slice((page-1)*50, page*50)`
- Show `Pagination` only if `filtered.length > 50`
- Use the existing `src/components/ui/pagination.tsx` component

### 3. Add Client-Side Pagination to StudentProfilesManagement
Same pattern as above — `page`, `pageSize = 50`, reset on search change.

### 4. Add Client-Side Pagination to StudentCasesManagement
Same pattern — already has a `filtered` array, just slice and add controls.

---

## What Does NOT Change

- No server-side filtering migration — current data scale makes this premature
- No changes to `useDashboardData`, `dataService`, or realtime subscriptions — already correct
- No SLA threshold changes — already reads 24h in code
- No tab switching changes — already refetching correctly
- No `useEffect` dependency changes — already correct
- No search standardization — out of scope for this phase (UX only)
- No RLS changes
- No database migrations

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/InfluencerDashboardPage.tsx` | Fetch `eligible_min` from `eligibility_thresholds`, use in stats + student filter |
| `src/components/admin/LeadsManagement.tsx` | Add `page` state + `Pagination` component (client-side, 50 per page) |
| `src/components/admin/StudentProfilesManagement.tsx` | Add `page` state + `Pagination` component |
| `src/components/admin/StudentCasesManagement.tsx` | Add `page` state + `Pagination` component |

---

## Technical Detail: Eligibility Threshold Fix

```typescript
// In InfluencerDashboardPage.tsx, add:
const [eligibleMin, setEligibleMin] = useState(50); // safe default

useEffect(() => {
  (supabase as any)
    .from('eligibility_thresholds')
    .select('eligible_min')
    .maybeSingle()
    .then(({ data }: any) => {
      if (data?.eligible_min) setEligibleMin(data.eligible_min);
    });
}, []);

// Then replace hardcoded 50 with eligibleMin:
const eligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) >= eligibleMin).length;
const ineligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) < eligibleMin && l.status !== 'new').length;

// And in filteredLeads useMemo:
if (studentFilter === 'eligible') return leads.filter(l => (l.eligibility_score ?? 0) >= eligibleMin);
if (studentFilter === 'ineligible') return leads.filter(l => (l.eligibility_score ?? 0) < eligibleMin && l.status !== 'new');
// Also add eligibleMin to useMemo deps
```

## Technical Detail: Pagination Pattern

```typescript
// Add to component:
const [page, setPage] = useState(1);
const PAGE_SIZE = 50;

// Reset page when filters change:
useEffect(() => { setPage(1); }, [search, filterStatus, filterSource]);

// Slice:
const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

// Render with existing Pagination component:
// Replace filtered.map(...) → paginated.map(...)
// Add <Pagination> below the list when totalPages > 1
```

---

## Expected Outcome

1. Influencer dashboard eligibility counts match admin-configured threshold exactly
2. All admin list views are pagination-ready for when data grows (no UX degradation at scale)
3. No regressions — all existing real-time, filtering, and tab functionality preserved
4. Phase 4 is complete with honest scope (4 targeted file changes, 0 migrations)
