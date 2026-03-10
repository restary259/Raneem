
## Remaining Steps — Full Fix Plan

### Current Build Error
`TeamDashboardPage.tsx` line 430: `handleMarkContacted(lead.id, c.id)` — function was refactored to take only `caseId` but the call site still passes 2 args. Fix: change to `handleMarkContacted(c.id)`.

### All Remaining Issues Found

**1. TeamDashboardPage.tsx — 8 issues remaining:**
- Line 398: `c.case_status` → `c.status` in `renderCaseActions`
- Line 430: `handleMarkContacted(lead.id, c.id)` → `handleMarkContacted(c.id)` (BUILD ERROR)
- Line 622: `matchesFilter(c.case_status, f)` → `matchesFilter(c.status, f)` in filter count
- Line 661: `c.case_status` → `c.status` for status label/color
- Line 663: `c.case_status` → `c.status` for neonBorder
- Line 666: `!!c.paid_at` → `c.status === 'enrollment_paid'` for isPaid
- Lines 292-295: `confirmPaymentAndSubmit` — uses `c.case_status`, `from('student_cases').update`, `lead_id` references
- Lines 317-333: `handleDeleteCase` — still uses `from('student_cases').delete()`
- Lines 363-370: `openProfileModal` still tries to find lead from `leads` array; `cases` table has direct `full_name`/`phone_number`
- Lines 791-798: today/appointments tab — uses `linkedCase.case_status` in 3 places
- Line 811: uses `appt.student_name` (old column) — appointments table has `guest_name` 

**2. ScheduleDialog.tsx — 4 issues:**
- Line 50: `scheduleForCase.lead_id` → case has `full_name` directly
- Line 55: `.eq('lawyer_id', userId)` → `.eq('team_member_id', userId)` 
- Line 66: `lawyer_id: userId` → `team_member_id: userId`; `student_name` → `guest_name`
- Line 73: `scheduleForCase.case_status` → `scheduleForCase.status`
- Line 74: `from('student_cases').update({ case_status: ... })` → `from('cases').update({ status: ... })`
- Line 96: `scheduleForCase.lead_id` in the display

**3. ReassignDialog.tsx — 4 issues:**
- Line 31: `REASSIGN_ALLOWED_STATUSES` uses old statuses like `'assigned'`, `'appointment_waiting'`, `'appointment_completed'` — update to new canonical statuses: `['new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed']`
- Line 35: `reassignCase.case_status` → `reassignCase.status`
- Line 41: `reassignCase.assigned_lawyer_id` → `reassignCase.assigned_to`
- Lines 43-46: `from('student_cases').update({ assigned_lawyer_id: ..., reassigned_from: ..., reassignment_notes: ..., reassignment_history: ... })` → `from('cases').update({ assigned_to: ... })` (remove fields not on cases table)
- Line 50: `p_target_table: 'student_cases'` → `'cases'`

**4. ProfileCompletionModal.tsx — 3 issues:**
- Line 123: `profileCase.case_status` → `profileCase.status`
- Line 124: `finalData.case_status` → `finalData.status`
- Line 129: `from('student_cases').update(finalData)` → `from('cases').update(finalData)`
- Line 133: `p_target_table: 'student_cases'` → `'cases'`

**5. LeadsManagement.tsx — 3 issues:**
- Lines 126-130: `markEligible` — `from('student_cases').select('id').eq('lead_id', ...)` → check `from('cases').select('id').eq('source', 'contact_form') // or just skip` — actually for leads, `markEligible` creates a NEW case using the new `cases` table. A lead marked eligible should create a `cases` row with `full_name`, `phone_number`, `source: 'contact_form'`
- Line 146: `from('student_cases').update({ deleted_at: null })` → `from('cases').update({ deleted_at: null })`
- Lines 148-152: `from('student_cases').insert(...)` → `from('cases').insert({ full_name: lead.full_name, phone_number: lead.phone, source: 'contact_form', city: lead.preferred_city })`
- Lines 177-199: `handleDelete` — remove the `from('student_cases').select/update` block entirely (table is being dropped; just cancel rewards by case notes lookup instead)
- Lines 217-234: `assignLawyer` — `from('student_cases').select/update/insert` all using `assigned_lawyer_id` → `from('cases').select/update/insert` using `assigned_to`

**6. NextStepButton.tsx — 1 issue:**
- Line 53: `from('student_cases').update({ case_status: ... })` → `from('cases').update({ status: ... })`

**7. ReadyToApplyTable.tsx — Full rewrite of fetchData:**
- Line 66: `from('student_cases')...eq('case_status', 'ready_to_apply')` → `from('cases')...eq('status', 'enrollment_paid')`
- All field refs: `lead_id` → removed (cases have direct name/phone), `assigned_lawyer_id` → `assigned_to`, `case_status` → `status`, `student_full_name` → `full_name`, `student_phone` → `phone_number`
- Remove join to `leads` table (not needed anymore since cases has name/phone directly)
- The `ReadyCase` interface needs to be updated to reflect cases table fields

**8. SecurityPanel.tsx — 1 issue:**
- Line 105: `from('student_cases').select('id, student_full_name, fraud_flagged, fraud_notes').eq('fraud_flagged', true)` → cases table has no fraud fields. Change to query `from('leads')` where `fraud_flags` array is not empty: `.not('fraud_flags', 'eq', '{}')` and display lead names with fraud flags

**9. InfluencerManagement.tsx — 1 issue:**
- Line 83: `fnName = dbRole === 'influencer' ? 'create-influencer' : 'create-team-member'` — `dbRole` after mapping will never be `'influencer'` (it's now `'social_media_partner'`). Fix: `fnName = dbRole === 'social_media_partner' ? 'create-influencer' : 'create-team-member'`

**10. PayoutsManagement.tsx — 2 issues:**
- Line 61: `requestor_role === 'influencer'` → `requestor_role === 'social_media_partner'`
- Line 124: `type: payTarget.requestor_role === 'influencer' ? 'influencer_payout' : 'student_cashback'` → `requestor_role === 'social_media_partner'`

**11. KPIAnalytics.tsx — 2 issues:**
- Line 52: `totalRevenue` adds `c.school_commission` — per the plan, remove `school_commission` from revenue (it's a legacy field); revenue = `service_fee` only
- Line 53: `totalCosts` adds `c.influencer_commission + c.lawyer_commission + c.referral_discount` — replace with `c.platform_revenue_ils` logic or use `cases.platform_revenue_ils`. Simplify: costs = `c.influencer_commission + c.lawyer_commission` (which are now properly named via the DB function), remove `referral_discount` (not part of new model)
- Lines 69-70: monthly trend — same fix

**12. MoneyDashboard.tsx — KPIs already read from `cases` table correctly. However:**
- Lines 148-149: still shows `school_commission` as revenue row — per plan, remove school_commission (legacy)
- Lines 170: `totalSchoolComm` in KPIs — remove
- Lines 174: `totalRevenueNIS = totalServiceFees + totalSchoolComm` → `= totalServiceFees`

**13. DB Migration 5 — Drop student_cases:**
After all code above is migrated, create the final migration:
```sql
DROP TABLE IF EXISTS public.student_cases CASCADE;
```

### Files Changing
| File | Change |
|------|--------|
| `TeamDashboardPage.tsx` | Fix build error + 7 remaining `case_status`/`student_cases`/`lead_id` references |
| `ScheduleDialog.tsx` | Fix `lawyer_id`→`team_member_id`, `student_name`→`guest_name`, `student_cases`→`cases`, `case_status`→`status`, lead_id display |
| `ReassignDialog.tsx` | Fix statuses, `case_status`→`status`, `assigned_lawyer_id`→`assigned_to`, `student_cases`→`cases` |
| `ProfileCompletionModal.tsx` | Fix `case_status`→`status`, `student_cases`→`cases` |
| `LeadsManagement.tsx` | Fix `markEligible`, `assignLawyer`, `handleDelete` to use `cases` table |
| `NextStepButton.tsx` | Fix `student_cases`→`cases`, `case_status`→`status` |
| `ReadyToApplyTable.tsx` | Rewrite `fetchData` to query `cases` with `status=enrollment_paid` + fix interface |
| `SecurityPanel.tsx` | Fix fraud query from `student_cases` to `leads.fraud_flags` |
| `InfluencerManagement.tsx` | Fix `fnName` check from `'influencer'` to `'social_media_partner'` |
| `PayoutsManagement.tsx` | Fix 2x `'influencer'` → `'social_media_partner'` |
| `KPIAnalytics.tsx` | Remove `school_commission` from revenue, remove `referral_discount` from costs |
| `MoneyDashboard.tsx` | Remove `school_commission` row and KPI |
| New migration | `DROP TABLE IF EXISTS public.student_cases CASCADE` |
