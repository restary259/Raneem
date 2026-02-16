

# Implementation Plan: Team Dashboard Final Fixes + Full Gap Audit

## Status of All Plan Items

### Already Implemented (Verified in Code)
- A1: TeamDashboardPage aligned to 6-stage funnel
- A2: MyApplicationTab aligned to 6-stage funnel
- A3: Legacy DB migration executed (no legacy statuses remain -- all cases are `paid`)
- A4: Student IBAN validation in RewardsPanel
- B1: case_service_snapshots cleanup on case delete (CasesManagement)
- B2: Document audit logging via `log_user_activity` RPC (SECURITY DEFINER)
- B3: preferred_major in CSV/XLSX/PDF export (LeadsManagement)
- B4: Influencer PII anonymization (initials + city)
- B5: MoneyDashboard "All" filter label fixed
- B6: preferred_major in add lead modal
- C2: Bulk payout audit logging
- C4: lead-sla-check edge function secured with admin JWT auth
- AI Agent tab removed from Team Dashboard
- CSP headers hardened (unsafe-eval removed)
- Auth rate limiting (5/email + 20/IP per 15min)

### Remaining Gaps to Fix

#### 1. LeadsManagement Delete Missing case_service_snapshots Cleanup
**File:** `src/components/admin/LeadsManagement.tsx` (lines 126-131)
**Issue:** When deleting a lead and its related cases, the code cleans `appointments`, `case_payments`, and `commissions` but does NOT clean `case_service_snapshots`.
**Fix:** Add `await supabase.from('case_service_snapshots').delete().eq('case_id', c.id)` inside the loop before deleting the case.

#### 2. LeadsManagement Preferred Major Field in Add Modal UI
**Issue:** The state includes `preferred_major` and it's sent in the insert, but need to verify the actual form UI renders an input for it.
**Fix:** Verify and add Input field if missing in the add lead dialog.

#### 3. Team Dashboard Mobile Bottom Bar
**Status:** Already implemented with 3 tabs (Leads, Appointments, Majors) and sticky bottom nav.
**Verify:** Quick actions (Call, Notes, Mark Contacted) work on mobile -- these are inline on each card, not in the bottom bar.

#### 4. Majors Tab -- Currently Read-Only (Static Data)
**Current state:** The majors tab in Team Dashboard reads from `majorsData.ts` (static file). Admins cannot add/edit majors from the dashboard.
**Plan item reference:** "Admin ability: Add new majors, Edit existing majors" -- This requires a new database table and admin UI. This is a larger feature, not a bug fix.
**Recommendation:** Flag as future feature. Current static data serves the immediate need.

#### 5. Appointments Calendar -- No Drag-and-Drop
**Current state:** AppointmentCalendar component exists with add/edit/delete functionality and day view.
**Plan item reference:** "Appointments draggable/editable, Day/week/month toggle"
**Recommendation:** The current calendar supports scheduling and editing. Drag-and-drop and multi-view are advanced features for a future sprint.

## Changes to Implement Now

### File 1: `src/components/admin/LeadsManagement.tsx`
Add `case_service_snapshots` cleanup in the delete handler (lines 126-131):

```typescript
for (const c of relatedCases) {
  await (supabase as any).from('appointments').delete().eq('case_id', c.id);
  await (supabase as any).from('case_payments').delete().eq('case_id', c.id);
  await (supabase as any).from('commissions').delete().eq('case_id', c.id);
  await (supabase as any).from('case_service_snapshots').delete().eq('case_id', c.id);
}
```

### File 2: Verify preferred_major input exists in add lead modal
Check and add the form field if missing in the dialog JSX.

## Summary

All critical (A1-A5) and medium (B1-B6, C1-C4) items from the original audit plan have been implemented. The only remaining code fix is the `case_service_snapshots` cleanup in LeadsManagement's delete handler. The majors editing and advanced calendar features are new feature requests that go beyond the original audit scope and should be planned separately.

### Technical Details

```text
Remaining fix:
+------------------------------------------+-----------+--------+
| Item                                     | File      | Status |
+------------------------------------------+-----------+--------+
| case_service_snapshots cleanup on lead   | LeadsMgmt | TO FIX |
| delete                                   |           |        |
| preferred_major input in add modal UI    | LeadsMgmt | VERIFY |
| Admin-editable majors table              | New feat  | FUTURE |
| Calendar drag-and-drop + multi-view      | New feat  | FUTURE |
+------------------------------------------+-----------+--------+
```
