
## Full Diagnosis & Fix Plan

### What the screenshots show (pre-fix state):
- **Overview**: shows 1 case (raneem, apply_page) — correct with old fallback logic
- **Students page**: shows 0 — OLD code used `.eq("partner_id", uid)`, all cases have `partner_id=null`
- **Earnings page**: shows ₪0 — reads from `commission_transactions` table which has 0 rows

### Root causes confirmed from DB audit:

**Bug A — Students page: 0 results (FIXED in code, but need to verify)**
The code was correctly updated in the last session. DB check confirms: RLS `Partners can read own override` policy ✅ exists, override row has `show_all_cases=true` → no filter → all cases visible. The students page should now work.

**Bug B — Earnings shows ₪0 (STILL BROKEN)**
`PartnerOverviewPage` fetches `totalEarned` from `commission_transactions` table → **0 rows in that table** → always ₪0. The actual commission data lives in the `cases` table as `influencer_commission` column (written by `record_case_commission`) or in `rewards`. The `commission_transactions` table is a legacy/unused table in this pipeline. The "Total Paid Out" KPI needs to be sourced from `rewards` (where `record_case_commission` writes partner commissions) not `commission_transactions`.

**Bug C — Earnings page: reads `cases.source` but doesn't select it**
`PartnerEarningsPage` builds a visibility filter using `source` column but the select list is `id,full_name,status,created_at` — **missing `source`**. When `show_all_cases===false`, the `.in("source", [...])` filter still works (Supabase can filter on columns not in SELECT), but this can cause unexpected behavior. Minor but should be fixed.

**Bug D — All cases have `partner_id=null`**  
The `record_case_commission` function only creates rewards when `partner_id IS NOT NULL`. Our fix in `AdminSubmissionsPage` auto-links the partner BEFORE calling `admin-mark-paid`, but raneem's case was submitted BEFORE this fix. Since raneem is already in `submitted` status and no commission was written, the "Total Paid Out" will be 0 even after fixing the table source — until admin marks a NEW case enrolled.

### What to fix now — 2 code files only (no DB changes needed):

**Fix 1: `PartnerOverviewPage.tsx` — replace `commission_transactions` with `rewards`**

The overview's "Total Paid Out" (totalEarned) currently queries:
```js
supabase.from("commission_transactions").select("*").eq("partner_id", uid)
```
Replace with:
```js
supabase.from("rewards").select("amount,status").eq("user_id", uid).in("status", ["approved","paid"])
```
And `totalEarned = rewards.reduce((sum, r) => sum + r.amount, 0)`

This matches how `record_case_commission` actually stores partner commissions.

**Fix 2: `PartnerEarningsPage.tsx` — add `source` to select list**

Change:
```js
.select("id,full_name,status,created_at")
```
To:
```js
.select("id,full_name,status,created_at,source")
```

**Fix 3: Both pages — add error logging to catch silent failures**

Both pages use `const { data } = await query` with no error check. Add:
```js
const { data, error } = await query;
if (error) console.error("cases fetch error:", error);
```
This will expose any remaining silent RLS or query failures in the console.

**Fix 4: `PartnerStudentsPage.tsx` — add `source` to select list (same as Fix 2)**

Currently selects `id,full_name,status,created_at,source` — already has source ✅. Just needs error logging added.

### Files to change: 2 files

| File | Change |
|------|---------|
| `src/pages/partner/PartnerOverviewPage.tsx` | Switch totalEarned from `commission_transactions` → `rewards`; add error logging to cases query |
| `src/pages/partner/PartnerEarningsPage.tsx` | Add `source` to select list; add error logging to cases query |
| `src/pages/partner/PartnerStudentsPage.tsx` | Add error logging to cases query |

### No DB migration needed
All tables and RLS policies are correct. The fixes are purely in the frontend data-fetching layer.

### After these fixes, the flow will be:
1. Partner logs in → reads own `partner_commission_overrides` row (RLS allows it ✅)
2. `show_all_cases=true` → no filter → all cases returned (RLS on cases allows for social_media_partner ✅)  
3. Students page: shows all 4 cases with friendly status labels ✅
4. Earnings page: shows cases in paid statuses with correct commission amount ✅
5. Overview "Total Paid Out": reads from `rewards` table where actual commissions land ✅
6. Real-time: any change to commission_overrides/cases triggers refetch ✅
