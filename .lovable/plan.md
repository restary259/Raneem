
## Complete Status Scan + Remaining Implementation Plan

### What the previous session ALREADY completed (confirmed by code inspection)

1. **Database migration** — `translation_fee`, `has_translation_service`, `translation_added_by_user_id` dropped from `student_cases`; `translation_fee` dropped from `case_submissions`; `auto_split_payment` trigger updated
2. **`KPIAnalytics.tsx`** — `€` → `₪`, `translation_fee` removed from costs, funnel now uses 7-stage canonical statuses, `paidCases` uses `status === 'enrollment_paid'`, `teamMemberData` uses `assigned_to` ✅
3. **`MoneyDashboard.tsx`** — Switched to `cases` table + `enrollment_paid` status, translation rows removed, `InfluencerPayoutsTab` import/tab already removed ✅
4. **`PaymentConfirmationForm.tsx`** — `translation_fee: 0` removed ✅
5. **`ProfileCompletionModal.tsx`** — `has_translation_service` checkbox removed ✅
6. **`AdminFinancialsPage.tsx`** — Already clean, queries `cases` + `case_submissions` with no `translation_fee` ✅
7. **`CaseDetailPage.tsx`** — `translation_fee` removed from Submission interface ✅
8. **`SubmitNewStudentPage.tsx`** — `translation_fee: 0` removed ✅

### What REMAINS to implement

**1. `src/types/database.ts`** — Still has 3 translation fields on `StudentCase` interface (lines 63-65):
- Remove `has_translation_service: boolean`
- Remove `translation_fee: number`
- Remove `translation_added_by_user_id: string | null`

**2. `src/components/admin/StudentCasesManagement.tsx`** — Still has:
- Lines 298-303: `has_translation_service` badge in the "services" tab
- Line 343: `translation_fee: 0` in `setMoneyValues()` initialization

**3. `src/integrations/supabase/dataService.ts`** — Still has legacy role names:
- Line 195: `eq('role', 'influencer')` → change to `eq('role', 'social_media_partner')`
- Line 197: `from('student_cases')` → change to `from('cases')` for admin dashboard cases (so `MoneyDashboard` gets the right table)
- Line 198: `eq('role', 'lawyer')` → change to `eq('role', 'team_member')`
- Line 199 comment: update to reflect new source of truth
- `getTeamDashboard()` line 105: still queries `student_cases` with `assigned_lawyer_id` — team dashboard should query `cases` with `assigned_to`
- Line 115: `eq('lawyer_id', userId)` in appointments — appointments table uses `team_member_id`, not `lawyer_id`; check actual schema (schema shows `team_member_id`)
- `getInfluencerDashboard()` line 49: still queries `student_cases` — switch to `cases` table with `partner_id = userId`

**4. `src/components/admin/InfluencerPayoutsTab.tsx`** — File still exists (600 lines). It is no longer imported anywhere (MoneyDashboard already removed it). Delete this file.

**5. `src/components/dashboard/RewardsPanel.tsx`** — Audit done: this is the STUDENT rewards panel. It shows referral cashbacks (student-to-student referrals), not commission splits. It correctly has no "earn/payout from cases" logic — only referral rewards. The `requestor_role: 'student'` is correct. Keep as-is but fix the `locale` variable on line 30 which sets `locale = 'ar'` for Arabic dates → change to always `'en-US'` to avoid Arabic-Indic numerals.

**6. `src/pages/TeamDashboardPage.tsx`** — Line 99: `eq('role', 'lawyer')` → change to `eq('role', 'team_member')`

### Implementation order

1. `types/database.ts` — remove 3 fields
2. `StudentCasesManagement.tsx` — remove translation badge + moneyValues key
3. `dataService.ts` — fix role names, switch admin cases from `student_cases` to `cases`, fix team dashboard query from `student_cases`/`assigned_lawyer_id` to `cases`/`assigned_to`, fix appointments from `lawyer_id` to `team_member_id`
4. `TeamDashboardPage.tsx` — fix role check from `lawyer` to `team_member`
5. `RewardsPanel.tsx` — fix date locale
6. Delete `InfluencerPayoutsTab.tsx`

### Files changing
| File | Change |
|------|--------|
| `src/types/database.ts` | Remove 3 translation fields from `StudentCase` |
| `src/components/admin/StudentCasesManagement.tsx` | Remove `has_translation_service` badge (lines 298-303) + `translation_fee: 0` key (line 343) |
| `src/integrations/supabase/dataService.ts` | Role names `influencer`→`social_media_partner`, `lawyer`→`team_member`; admin cases `student_cases`→`cases`; team dashboard `student_cases`/`assigned_lawyer_id`→`cases`/`assigned_to`; appointments `lawyer_id`→`team_member_id` |
| `src/pages/TeamDashboardPage.tsx` | Role check `lawyer`→`team_member` |
| `src/components/dashboard/RewardsPanel.tsx` | Date locale from `'ar'` to `'en-US'` |
| `src/components/admin/InfluencerPayoutsTab.tsx` | **DELETE** (no longer imported anywhere) |
