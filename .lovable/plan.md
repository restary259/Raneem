
## Full Audit Complete — Implementation Plan

### What I Found After Reading Every Relevant File

**Files to DELETE:**
1. `src/components/lawyer/AppointmentCalendar.tsx` — imported ONLY in `TeamDashboardPage.tsx`. Functionality duplicated by `AppointmentSchedulerModal.tsx` (new, uses `cases` table + `team_member_id`). AppointmentCalendar still writes to `student_cases` and uses `lawyer_id` in appointments insert.
2. `src/components/lawyer/OverviewTab.tsx` — not imported anywhere. Dead file.
3. `src/pages/InfluencerDashboardPage.tsx` — old legacy dashboard at `/influencer-dashboard`. Route redirects to `/partner`. Imports `EarningsPanel`, `ReferralLink` from influencer/ folder. Self-contained.
4. `src/components/influencer/EarningsPanel.tsx` — only imported by `InfluencerDashboardPage.tsx` (being deleted). The new Partner Dashboard uses `PartnerEarningsPage.tsx` directly.
5. `src/components/influencer/ReferralLink.tsx` — only imported by `InfluencerDashboardPage.tsx` (being deleted).
6. `src/components/influencer/MediaHub.tsx` — search confirmed: not imported anywhere. Dead file.
7. `src/pages/placeholders/PartnerPlaceholderPage.tsx` — not imported anywhere (checked App.tsx — partner routes use `PartnerOverviewPage`). Dead placeholder.
8. `src/pages/placeholders/TeamPlaceholderPage.tsx` — same.
9. `orm.tsx` at root — search found no import of it. It's listed in file list as a stray file. Delete.

**Files to MODIFY:**

**`src/App.tsx`** — Remove the 3 legacy redirect routes:
- `/influencer-dashboard` → `/partner`
- `/lawyer-dashboard` → `/team`
- `/team-dashboard` → `/team`
(Keep `/student-dashboard` → `/student/checklist` as students may have old bookmarks)
Remove import of `InfluencerDashboardPage` (lazy import line 45 is `AdminDashboardPage` not influencer — check: actually `InfluencerDashboardPage` is NOT imported in App.tsx — it was rendered via a direct route at `/influencer-dashboard` but actually looking at App.tsx it's already a redirect! So no import to remove. The redirect routes themselves just need removing.)

**`src/components/common/BottomNav.tsx`** — Remove `'/influencer-dashboard'` and `'/lawyer-dashboard'` from the `isDashboard` array (line 18). Keep `'/team-dashboard'` and `'/student-dashboard'` for safety.

**`src/pages/TeamDashboardPage.tsx`** — This is the largest file with multiple `student_cases` references. Required changes:
1. Remove `import AppointmentCalendar from "@/components/lawyer/AppointmentCalendar"` (line 33)
2. Replace the AppointmentCalendar usage in the "appointments" tab (line 918-921) with `AppointmentSchedulerModal` or a simple list of appointments (the new `CaseDetailPage.tsx` already has a full appointment UI — the team dashboard appointments tab can show the appointments list already loaded from `data?.appointments`)
3. Fix `c.assigned_lawyer_id` → `c.assigned_to` in the client-side filter (line 179)
4. Fix all `c.case_status` → `c.status` references (SLA check, kpis, filteredCases, renderCaseActions, card renders)
5. Fix `from('student_cases').update({ case_status: ... })` in `handleMarkContacted` → `from('cases').update({ status: ... })`
6. Fix `confirmPaymentAndSubmit` — remove `from('student_cases').update(...)`, replace with `from('cases').update({ status: CaseStatus.SUBMITTED, ... })`; remove `lead_id` references since new cases don't have lead_id
7. Fix `handleDeleteCase` — change `from('student_cases').delete()` to `from('cases').update({ deleted_at: new Date().toISOString() })` (soft delete)
8. Fix `realtime subscription 'student_cases'` → `'cases'` (line 186)
9. Fix fallback `user_roles.eq('role', 'lawyer')` in `fetchLawyers` → `eq('role', 'team_member')` (lines 132, 144)
10. Fix `c.lead_id` references — cases now have `full_name` and `phone_number` directly; `getLeadInfo` should fall back to case fields
11. Fix all `c.paid_at` references in kpis → cases don't have `paid_at`; use `c.status === 'enrollment_paid'`
12. Fix `c.lawyer_commission` → `c.influencer_commission` is already the partner commission; for team commission we need to read from `rewards` or use `c.lawyer_commission` field which still exists on cases
13. Fix SLA breach check: uses `c.case_status` → `c.status`

**`src/components/team/ScheduleDialog.tsx`** — Fix:
- Line 66: Remove `lawyer_id: userId` from appointments insert (column doesn't exist; correct column is `team_member_id`)
- Line 73-74: Change `from('student_cases').update({ case_status: ... })` to `from('cases').update({ status: ... })`
- Fix `scheduleForCase.case_status` → `scheduleForCase.status`

**`src/components/team/ReassignDialog.tsx`** — Fix:
- Line 35: `reassignCase.case_status` → `reassignCase.status`
- Line 41: `reassignCase.assigned_lawyer_id` → `reassignCase.assigned_to`
- Line 43-46: `from('student_cases').update({ assigned_lawyer_id: ..., ... })` → `from('cases').update({ assigned_to: ..., ... })`; remove `reassigned_from`, `reassignment_notes`, `reassignment_history` (not in new cases schema)
- Line 50: `p_target_table: 'student_cases'` → `'cases'`

**`src/components/team/ProfileCompletionModal.tsx`** — Fix:
- Line 123: `profileCase.case_status` → `profileCase.status`
- Line 124: `finalData.case_status` → `finalData.status`
- Line 129: `from('student_cases').update(finalData)` → `from('cases').update(finalData)`
- Line 133: `p_target_table: 'student_cases'` → `'cases'`
- Remove `translation_added_by_user_id` from payload if present

**`src/components/admin/LeadsManagement.tsx`** — The `markEligible`, `handleDelete`, `assignLawyer` functions still write to `student_cases`. Decision: 
- These functions create entries in `student_cases` for the OLD pipeline (leads → lawyer workflow). The NEW pipeline uses `cases` directly (team submits via `SubmitNewStudentPage`). 
- `markEligible` creates a `student_cases` row when admin marks a lead eligible — this is the OLD admin-side lead conversion flow. Since `student_cases` is being dropped, we need to adapt this to instead create a `cases` row.
- `handleDelete` cascades to `student_cases` soft-delete — remove those calls.
- `assignLawyer` inserts/updates `student_cases` with `assigned_lawyer_id` — migrate to `cases` with `assigned_to`.
- Specific changes: Replace all `from('student_cases')` with `from('cases')` using correct field mappings.

**`src/components/admin/NextStepButton.tsx`** — Line 53-56: `from('student_cases').update({ case_status: ... })` → `from('cases').update({ status: ... })`

**`src/components/admin/ReadyToApplyTable.tsx`** — This entire component queries `student_cases` with `case_status = 'ready_to_apply'` (a non-existent status in the new system). The new 7-stage pipeline doesn't have `ready_to_apply`. The component shows "enrolled but not yet submitted to consulate" cases. Since the admin now uses `AdminSubmissionsPage` for this, `ReadyToApplyTable` is effectively replaced. However it's used somewhere in admin tabs — need to check.

**`src/components/admin/ReferralManagement.tsx`** — Lines 63-77: Creates `student_cases` row from referral enrollment. Migrate to `cases` table.

**`src/components/admin/SecurityPanel.tsx`** — Line 105: `from('student_cases').select('fraud_flagged, fraud_notes')` → `from('cases')` — cases table doesn't have `fraud_flagged`/`fraud_notes` columns. Flag this as ambiguous: the `cases` table schema doesn't have fraud fields. The query will return empty. Change to show fraud alerts from `leads.fraud_flags` array instead.

**`src/components/admin/InfluencerManagement.tsx`** — Fix legacy role string constants:
- `filterRole?: 'influencer' | 'lawyer'` — keep as UI strings but fix DB calls
- Line 82: `dbRole = effectiveRole === 'lawyer' ? 'team_member' : effectiveRole` — change `effectiveRole` influencer branch too: `dbRole = effectiveRole === 'lawyer' ? 'team_member' : 'social_media_partner'`
- Line 83: `fnName = dbRole === 'influencer'` → `fnName = dbRole === 'social_media_partner' ? 'create-influencer' : 'create-team-member'`
- Lines 56-63: internal `_role` tagging for UI display stays as-is (cosmetic)

**`src/components/admin/PayoutsManagement.tsx`** — Fix:
- Line 61: `requestor_role === 'influencer'` → `requestor_role === 'social_media_partner'`
- Line 124: `type: payTarget.requestor_role === 'influencer' ? 'influencer_payout' : 'student_cashback'` → use `'social_media_partner'`

**`src/components/admin/KPIAnalytics.tsx`** — Still has `c.influencer_commission` and `c.lawyer_commission` in cost calculations (lines 53, 70). These should be removed per Step 5 (remove `school_commission`, `influencer_commission`, `lawyer_commission`, `referral_discount` from KPI calculations). Replace with `c.platform_revenue_ils` from cases table (once `commission_split_done` guard is added). For now, simplify to: revenue = `service_fee` (from enriched merge), costs = sum of rewards paid per case.

**`src/components/admin/MoneyDashboard.tsx`** — Fix per Step 5:
- Revenue: `c.service_fee` (already merged from `case_submissions` via `dataService.ts`)  
- Team payout: `rewards` where `admin_notes LIKE 'Team commission%'`
- Partner payout: `rewards` where `admin_notes LIKE 'Partner commission%'`
- Admin net: `c.platform_revenue_ils` (once available post-split)
- Remove `c.school_commission`, `c.influencer_commission`, `c.lawyer_commission` references

**`src/pages/admin/AdminSubmissionsPage.tsx`** — Step 4: Change pending query from `.eq('status', 'submitted')` to `.in('status', ['submitted', 'payment_confirmed'])`

**DB MIGRATIONS needed:**

**Migration 1 — Drop translation columns (if not already done):**
```sql
ALTER TABLE public.case_submissions DROP COLUMN IF EXISTS translation_fee;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS translation_fee;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS has_translation_service;
ALTER TABLE public.student_cases DROP COLUMN IF EXISTS translation_added_by_user_id;
```

**Migration 2 — Drop commission_tiers:**
```sql
DROP TABLE IF EXISTS public.commission_tiers CASCADE;
DROP FUNCTION IF EXISTS public.get_influencer_tier_commission(uuid);
```

**Migration 3 — Add commission_split_done guard to cases:**
```sql
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS commission_split_done boolean NOT NULL DEFAULT false;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS platform_revenue_ils integer NOT NULL DEFAULT 0;
```

**Migration 4 — Replace record_case_commission with idempotent version:**
The full `CREATE OR REPLACE FUNCTION` as specified by user in Step 3.

**Migration 5 — Drop student_cases (after all code is migrated):**
```sql
DROP TRIGGER IF EXISTS trg_auto_split_payment ON public.student_cases;
DROP TABLE IF EXISTS public.student_cases CASCADE;
```

**Migration 6 — Update auto_split_payment trigger** (for cases table if it fires there — the DB functions show it fires on `student_cases` via `NEW.case_status`. Since student_cases is being dropped, this trigger will be dropped automatically with it via CASCADE. No separate action needed.)

### Ambiguous/Flagged Items

1. **`ReadyToApplyTable.tsx`**: This component reads `case_status = 'ready_to_apply'` which was a legacy status. After migration, it will always show empty results. It is used in the admin panel tabs. I will update it to query `cases` with `status = 'enrollment_paid'` instead, giving it a new purpose: showing recently enrolled cases with their student details.

2. **`SecurityPanel.tsx` fraud cases**: The `cases` table has no `fraud_flagged` column. I'll change the query to read from `leads.fraud_flags` (which IS an array column on leads) and show leads with non-empty fraud_flags instead.

3. **`TeamDashboardPage.tsx` AppointmentCalendar replacement**: The appointments tab currently renders `<AppointmentCalendar>` which will be deleted. I'll replace it with an inline list of appointments using the already-loaded `appointments` array (same pattern as the "Today" tab which already renders `todayAppointments` as cards).

4. **`orm.tsx` at root**: Listed in the project files but the search found no content/imports. Will delete it.

### Implementation Order
1. DB migrations 1–4 first (guard column, replace function, drop legacy tables/functions) 
2. Delete files
3. Modify `App.tsx` + `BottomNav.tsx`
4. Modify `TeamDashboardPage.tsx` (largest, most impacted)
5. Modify team sub-components: `ScheduleDialog`, `ReassignDialog`, `ProfileCompletionModal`
6. Modify admin components: `LeadsManagement`, `NextStepButton`, `ReadyToApplyTable`, `ReferralManagement`, `SecurityPanel`, `InfluencerManagement`, `PayoutsManagement`
7. Modify financial components: `KPIAnalytics`, `MoneyDashboard`, `AdminSubmissionsPage`
8. DB migration 5 — drop `student_cases` last (after all code is confirmed migrated)
