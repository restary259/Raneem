
## Full picture of the codebase

### What already exists vs what the prompt assumes

**Phase 1 — Migrations:**
- `platform_revenue_ils` and `commission_split_done` columns ALREADY EXIST on `cases` table (confirmed in schema)
- The existing `record_case_commission` DB function is already there but uses OLD single-partner logic (only `v_case.partner_id`)
- `auto_split_payment` trigger function needs updating (must loop all partners)
- `student_cases` table references still exist in 3 edge functions + 1 React component
- `commission_tiers` table — unknown if exists; migration uses `DROP IF EXISTS` so safe
- `translation_fee` columns — unknown if exist on `case_submissions`; `DROP IF EXISTS` so safe

**Phase 2 — Dead files:**
- `src/components/lawyer/` — ALREADY EMPTY (confirmed)
- `src/components/influencer/` — ALREADY EMPTY (confirmed)
- `src/pages/placeholders/` — ALREADY EMPTY (confirmed)
- `src/pages/InfluencerDashboardPage.tsx` — does NOT exist (confirmed)
- `orm.tsx` at repo root — is actually a VALID file: `orm.tsx src/components/dashboard/ReferralTracker.tsx` (shown in file list, contains ReferralTracker component). The filename shown in the project tree is literally `orm.tsx src/components/dashboard/ReferralTracker.tsx` — this is a renamed/corrupted filename. It IS the `ReferralTracker.tsx` content but at the wrong path. This file should NOT be deleted — it is actively used. **Flag: verify if `src/components/dashboard/ReferralTracker.tsx` also exists** — yes it does (shown separately in the file list). The `orm.tsx` root file appears to be a duplicate/artifact. Safe to delete only if nothing imports it.

**Phase 3 — student_cases migration:**
- `src/components/admin/ReferralManagement.tsx` — 2 writes to `student_cases` (lines 64-77): the `if (!existingCase)` block is dead code for the auto-case creation when referral status changes to `enrolled`. Cases no longer come from `student_cases`. This block should be removed entirely (or redirected to insert into `cases` table).
- `src/pages/StudentDashboardPage.tsx` — only subscribes to `student_cases` for realtime; should be changed to `cases`
- Edge functions with `student_cases`: `purge-account`, `health-check`, `create-student-account` — all 3 need updating
- `src/pages/admin/AdminSettingsPage.tsx` — has a comment referencing `student_cases`

**Phase 4 — Role naming:**
- `src/components/admin/InfluencerManagement.tsx` — uses `'influencer'` and `'lawyer'` as internal UI strings that get mapped to DB names at line 82-83 (already maps correctly: `dbRole = effectiveRole === 'lawyer' ? 'team_member' : 'social_media_partner'`). The internal UI type strings `'influencer' | 'lawyer'` are just local TypeScript types — they do NOT hit the DB directly. The DB calls already use correct names. **Minimal change needed here** — just the `filterRole` type annotation and display logic.
- `src/components/admin/PayoutsManagement.tsx` — already uses `'social_media_partner'` on line 61 (correct). But `supabase/functions/admin-early-release/index.ts` uses `requestor_role: 'influencer'` — needs fixing.
- `src/components/chat/ChatWidget.tsx` — has `'/influencer-dashboard'` in hide list — should be cleaned up

**Phase 5 — Admin Submissions:**
- Query already correctly uses `.in('status', ['submitted', 'payment_confirmed'])` (lines 104-106) — **already fixed**
- `loadSplitPreview` function (lines 157-183) only fetches ONE partner override based on `case.partner_id` — needs to be changed to loop ALL partners from `partner_commission_overrides` and apply visibility rules per case source
- `CommissionPreview` interface needs to be expanded to hold multiple partner entries
- The split preview UI (lines 626-643) shows only one "Partner Commission" line — needs to show each qualifying partner separately

**Phase 6 — Financial dashboards:**
- `KPIAnalytics.tsx` — lines 53-54 use `c.influencer_commission` and `c.lawyer_commission` for costs. These fields exist on `cases` table (they do: `influencer_commission` and `lawyer_commission` are columns) but are set during commission split. Should change to read from `rewards` table via `admin_notes` LIKE patterns. However, since `cases.platform_revenue_ils` holds the admin net, can use that directly.
- `MoneyDashboard.tsx` — lines 148-153 use `c.influencer_commission` and `c.lawyer_commission`. Same issue. Need to switch to rewards-based approach or use `platform_revenue_ils`.
- `PartnerOverviewPage.tsx` — "Total Paid Out" card reads from `rewards` table (shows ₪0). Change to show `paid * commissionRate` (projection) and rename label to "إجمالي الأرباح المتوقعة"
- `PartnerEarningsPage.tsx` — disclaimer text update only

**Phase 7 — ReadyToApplyTable:**
- The prompt says to DELETE `ReadyToApplyTable` because it queries `case_status = 'ready_to_apply'` which no longer exists. But actually the file ALREADY queries `cases` table with `status === 'enrollment_paid'` (line 41) — it was already migrated! It's not broken. **Flag: do NOT delete this file — it already works correctly and shows enrolled cases for school export.**

---

## Plan

### Scope summary — what actually needs to change

**6 DB migrations** (in order, some guard with IF EXISTS/OR REPLACE):
1. Drop translation_fee columns (safe, IF EXISTS)
2. Drop commission_tiers table (safe, IF EXISTS)
3. Guard columns already exist — skip migration 3 or make it idempotent
4. Replace `record_case_commission` with multi-partner version
5. Drop `student_cases` (LAST — after all code is migrated)
6. Update `auto_split_payment` trigger function

**Files to change:**

| File | Change |
|------|--------|
| `src/components/admin/ReferralManagement.tsx` | Remove dead `student_cases` insert block (lines 62-83); replace with `cases` insert or remove entirely |
| `src/pages/StudentDashboardPage.tsx` | Change `student_cases` realtime subscription to `cases` |
| `supabase/functions/purge-account/index.ts` | Change `student_cases` → `cases`, `assigned_lawyer_id` → `assigned_to` |
| `supabase/functions/health-check/index.ts` | Remove `student_cases` queries (replaced by `cases`) |
| `supabase/functions/create-student-account/index.ts` | Change `student_cases` → `cases`, field names updated |
| `supabase/functions/admin-early-release/index.ts` | Change `requestor_role: 'influencer'` → `'social_media_partner'` |
| `src/components/chat/ChatWidget.tsx` | Remove `/influencer-dashboard` and `/lawyer-dashboard` from hide path list |
| `src/pages/admin/AdminSubmissionsPage.tsx` | Update `loadSplitPreview` to loop all partners; update `CommissionPreview` interface; update split UI to show each partner line |
| `src/components/admin/KPIAnalytics.tsx` | Replace `influencer_commission + lawyer_commission` costs with rewards-based sum or `platform_revenue_ils` |
| `src/components/admin/MoneyDashboard.tsx` | Replace `influencer_commission` and `lawyer_commission` with rewards-table data |
| `src/pages/partner/PartnerOverviewPage.tsx` | Change "Total Paid Out" KPI from rewards table to projection (paid × rate); rename label |
| `src/pages/partner/PartnerEarningsPage.tsx` | Update disclaimer text only |

**Files NOT to change (already correct):**
- `src/App.tsx` — no `/influencer-dashboard` or `/lawyer-dashboard` routes exist
- `src/components/common/BottomNav.tsx` — no such routes in isDashboard check
- `src/components/admin/ReadyToApplyTable.tsx` — already queries `cases` correctly, keep it
- `src/components/admin/InfluencerManagement.tsx` — DB role mapping already correct at line 82
- `src/components/admin/PayoutsManagement.tsx` — already uses `social_media_partner` correctly
- `src/pages/admin/AdminSubmissionsPage.tsx` pending query — already uses correct statuses
- `src/components/admin/SecurityPanel.tsx` — already queries `leads.fraud_flags` (line 106-108)

**Files to delete:**
- `orm.tsx` (root) — confirmed duplicate of `ReferralTracker.tsx`; nothing imports this path

**Edge functions to update (3):**
- `purge-account`, `health-check`, `create-student-account`

---

## Execution order

1. Run DB migrations 1-4 and 6 first (skip migration 3 — columns exist). Migration 5 (DROP student_cases) runs LAST after all code changes.
2. Update all React + edge function code to remove `student_cases` references.
3. Run migration 5 (drop student_cases).
4. Apply financial dashboard fixes.
5. Apply partner overview projection fix.
6. Delete `orm.tsx`.
7. Fix ChatWidget and admin-early-release role string.

---

## Commission math verification (example)

For case with `service_fee = 5000`:
- Team: `team_member_commission_overrides.commission_amount = 200`  
- Partner A (`show_all_cases = true`, applies to all sources): `commission_amount = 1000`  
- Partner B (`show_all_cases = false`, apply_page source qualifies): `commission_amount = 800`  
- Admin remainder: `5000 - 200 - 1000 - 800 = 3000`  
- Stored in `cases.platform_revenue_ils = 3000`  
- `commission_split_done = true` prevents re-split  

The new `record_case_commission` loops ALL rows in `partner_commission_overrides`, checks each partner's `show_all_cases` vs `case.source`, and inserts separate `rewards` rows for each qualifying partner.

---

## Flagged items

1. **`orm.tsx`** — The filename in the project file tree is literally `orm.tsx src/components/dashboard/ReferralTracker.tsx` which appears to be a corrupted/misnamed file at the repo root. Its content is the `ReferralTracker` component. `src/components/dashboard/ReferralTracker.tsx` exists separately and is what gets imported. The root `orm.tsx` is safe to delete — nothing imports it by that path.
2. **`ReadyToApplyTable.tsx`** — Prompt says to delete it because it "queries `case_status = 'ready_to_apply'`". This is incorrect — the file already uses `cases` table with `status = 'enrollment_paid'` and is a useful export tool. Keeping it.
3. **`create-student-account` edge function** — Still references `student_cases.student_phone`, `selected_city`, `selected_school`. Since `student_cases` is being dropped, this function needs to be rewritten to query `cases` instead. The equivalent columns on `cases` are `phone_number`, `city`, and `degree_interest`. The `student_profile_id` link should update `cases.student_user_id`.
4. **`src/components/admin/InfluencerManagement.tsx`** — Internal TypeScript union type `'influencer' | 'lawyer'` is UI-only. DB calls already map to correct role names. Only the `filterRole` prop type and display strings need renaming for consistency, but this is non-breaking. Will update for cleanliness.
