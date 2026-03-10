
## Full Audit, Cleanup & Financial System Unification Plan

### What I Found

**The system has two financial layers running in parallel:**

1. **Legacy layer** (`student_cases` table + `auto_split_payment` DB trigger) — used for old flow with `case_status='paid'`, tiered influencer commissions, translation fees, `commissions` table. Partially active.
2. **New layer** (`cases` table + `record_case_commission` DB function + `admin-mark-paid` edge function) — the canonical flow that `AdminSubmissionsPage` uses via override-based flat commissions.

**Dead code confirmed:**
- `InfluencerPayoutsTab.tsx` — reads from `student_cases` (legacy), uses `case_status='paid'` which is the old status (new system uses `enrollment_paid`), and matches rewards to cases via fragile string search in `admin_notes`
- `KPIAnalytics.tsx` — uses `€` currency symbol throughout, includes `translation_fee` in cost calculations, references dead statuses (`settled`, `ready_to_apply`, `completed`)
- `AdminFinancialsPage.tsx` — displays `translation_fee` alongside service fee in a breakdown column
- `MoneyDashboard.tsx` — builds transactions from `student_cases` legacy data (uses `c.paid_at`, `c.case_status === 'paid'`), excludes `translation_fee` from expenses while KPIAnalytics includes it → inconsistent net profit
- `ProfileCompletionModal.tsx` — has `has_translation_service` checkbox and `translation_added_by_user_id` tracking
- `StudentCasesManagement.tsx` — has `has_translation_service` badge displayed in case detail
- `dataService.ts` — `getInfluencerDashboard()` and `getTeamDashboard()` both query `student_cases` table; `getAdminDashboard()` also queries `student_cases`, `user_roles eq 'influencer'`, `user_roles eq 'lawyer'` (old role names)
- `PaymentConfirmationForm.tsx` — writes `translation_fee: 0` explicitly to `case_submissions` 
- `CaseDetailPage.tsx` (team) — `Submission` interface has `translation_fee` field
- `SubmitNewStudentPage.tsx` — writes `translation_fee: 0` to `case_submissions`
- `types/database.ts` — `StudentCase` interface has `has_translation_service`, `translation_fee`, `translation_added_by_user_id`

**Active new system code (keep):**
- `AdminSubmissionsPage.tsx` — the correct admin confirm-payment flow with split preview, password gate, calls `admin-mark-paid` → triggers `record_case_commission`
- `CommissionSettingsPanel.tsx` — override config per partner/team member — this IS the source of truth for splits
- `PartnerEarningsPage.tsx` — reads from `cases` table, computes earnings as `count × rate`
- `EarningsPanel.tsx` (influencer/team) — reads from `rewards` table for payout requests
- `PayoutsManagement.tsx` — admin payout approval flow
- `PaymentConfirmationForm.tsx` (team submits service fee to `case_submissions`) — keep but remove `translation_fee: 0` write
- `admin-mark-paid/index.ts` edge function — calls `record_case_commission`, this is correct

---

### Step-by-Step Plan

**DATABASE CHANGES (migration):**
1. Drop `translation_fee` column from `student_cases` table
2. Drop `has_translation_service` column from `student_cases` table
3. Drop `translation_added_by_user_id` column from `student_cases` table
4. The `auto_split_payment` DB trigger references `translation_fee` and `has_translation_service` on `student_cases` — update the trigger function to remove those branches (translation reward INSERT logic)
5. Drop `translation_fee` column from `case_submissions` table

> Note: Cannot modify `supabase/integrations/types.ts` — auto-generated. The migration changes will auto-update it.

**FILES TO MODIFY:**

`src/components/admin/KPIAnalytics.tsx`
- Remove `translation_fee` from `totalCosts` and `monthlyRevenue` cost calculations (lines 52, 69)
- Change all `€` symbols to `₪` (lines 158, 165, 170, 177, 272)
- Remove dead statuses from funnel: `ready_to_apply`, `settled` (lines 87-88)
- Change `paidCases` filter from `case_status === 'paid'` to `status === 'enrollment_paid'` since analytics reads from new `cases` table
- Fix `teamMemberData` to use `assigned_to` instead of `assigned_lawyer_id` (line 109 uses `c.assigned_lawyer_id` which is `student_cases` field)

`src/components/admin/MoneyDashboard.tsx`
- Change transaction builder to read from new `cases` table fields: use `c.status === 'enrollment_paid'` and `c.created_at` instead of `c.paid_at`/`c.case_status === 'paid'`
- Remove `referral_cashback` transaction row (referral discounts are not a commission split)
- Remove `referral_discount` from `totalExpensesNIS` calc (or keep as separate line — user to decide; I'll keep it as a discount line for visibility)
- KPI cards: rename to match new system (no translation fee card)
- Remove type filter option for dead types

`src/pages/admin/AdminFinancialsPage.tsx`
- Remove `translation_fee` from the `select()` query
- Remove `translationFees` from the state/display
- Fix the breakdown to show only `service_fee` (not `service_fee + translation_fee`)
- Remove the `+ translation_fee` breakdown line in the recent-enrolled list

`src/components/team/PaymentConfirmationForm.tsx`
- Remove `translation_fee: 0` from the `case_submissions` upsert payload

`src/pages/team/SubmitNewStudentPage.tsx`
- Remove `translation_fee: 0` from the `case_submissions` insert payload

`src/pages/team/CaseDetailPage.tsx`
- Remove `translation_fee` from the `Submission` interface

`src/components/team/ProfileCompletionModal.tsx`
- Remove `has_translation_service` checkbox and related state
- Remove `translation_added_by_user_id` from the upsert payload

`src/components/admin/StudentCasesManagement.tsx`
- Remove `has_translation_service` badge from case detail view (lines 298-303)
- Remove `translation_fee` from `moneyValues` state initialization (line 343)

`src/types/database.ts`
- Remove `has_translation_service`, `translation_fee`, `translation_added_by_user_id` from `StudentCase` interface

`src/integrations/supabase/dataService.ts`
- `getAdminDashboard()`: Change `student_cases` query to `cases` table (with correct field mapping) so MoneyDashboard gets data from the new unified system
- Change `user_roles eq 'influencer'` to `eq 'social_media_partner'`
- Change `user_roles eq 'lawyer'` to `eq 'team_member'`
- Update `AdminDashboardData` interface to remove legacy fields

`src/components/dashboard/RewardsPanel.tsx`
- Audit: Students should see their referral cashback (if any) — keep read-only view; confirm no "earn/payout" UI is shown. If there is a payout request button for students, remove it.

**FILES TO DELETE:**
- `src/components/admin/InfluencerPayoutsTab.tsx` — reads from `student_cases` legacy, uses `case_status='paid'` dead status, fragile reward matching. Its payout-request approval UI is already replicated in `PayoutsManagement.tsx` + the pending payout requests section. The per-influencer breakdown by countdown is dead since the countdown is tied to old `paid_countdown_started_at` field on `student_cases`.
  - Remove import + usage from `MoneyDashboard.tsx`'s `tabPayouts` tab section
  - Replace the "Agent Payouts" tab in MoneyDashboard with a redirect to `PayoutsManagement` or embed `PayoutsManagement` directly

**FINANCIAL FLOW AFTER CLEANUP:**

```text
Team submits case → adds service_fee to case_submissions
         ↓
Case status → 'submitted'
         ↓
Admin opens AdminSubmissionsPage → sees split preview (service_fee − partner_commission − team_commission = platform_revenue)
         ↓
Admin re-authenticates with password → clicks Confirm Enrollment
         ↓
admin-mark-paid edge function fires:
  1. cases.status → 'enrollment_paid'
  2. record_case_commission(case_id) called:
     - reads partner_commission_overrides or platform_settings.partner_commission_rate
     - reads team_member_commission_overrides or platform_settings.team_member_commission_rate
     - writes to cases.influencer_commission + cases.lawyer_commission
     - INSERTs pending reward for partner (rewards table)
     - INSERTs pending reward for team member (rewards table)
         ↓
Partner sees earnings in PartnerEarningsPage (count × rate from cases table)
Team sees earnings in EarningsPanel (rewards table)
Admin sees full split in MoneyDashboard + AdminSubmissionsPage
Student sees only their payment (service_fee) — no split info, no earnings
         ↓
After 20 days: Partner/Team can request payout → PayoutsManagement → Admin approves → marks paid
```

---

### Files Modified Summary
| File | Change |
|------|--------|
| `KPIAnalytics.tsx` | Remove translation_fee, fix € → ₪, fix status filters |
| `MoneyDashboard.tsx` | Switch to `cases` table, remove translation line, remove InfluencerPayoutsTab import/tab |
| `AdminFinancialsPage.tsx` | Remove translation_fee from queries and display |
| `PaymentConfirmationForm.tsx` | Remove translation_fee: 0 from upsert |
| `SubmitNewStudentPage.tsx` | Remove translation_fee: 0 from insert |
| `CaseDetailPage.tsx` | Remove translation_fee from Submission interface |
| `ProfileCompletionModal.tsx` | Remove has_translation_service checkbox + translation_added_by_user_id |
| `StudentCasesManagement.tsx` | Remove has_translation_service badge + translation moneyValues |
| `types/database.ts` | Remove 3 translation fields from StudentCase |
| `dataService.ts` | Switch admin cases to `cases` table, fix role names |

### Files Deleted
| File | Reason |
|------|--------|
| `InfluencerPayoutsTab.tsx` | Reads legacy `student_cases`, dead status `'paid'`, fragile string matching — functionality replaced by `PayoutsManagement.tsx` |

### Database Migration
1. Remove `translation_fee`, `has_translation_service`, `translation_added_by_user_id` from `student_cases`
2. Remove `translation_fee` from `case_submissions`
3. Update `auto_split_payment` trigger to remove translation reward branch
