

# Workflow Simplification and Permission Upgrade

## Overview

This plan aligns the case pipeline to a simplified 6-stage flow, ensures "Paid" is strictly admin-only, upgrades team member permissions to view all cases and reassign, and validates consistency across all dashboards.

---

## Current State vs Target State

```text
CURRENT (13 statuses):
  new -> eligible -> assigned -> contacted ->
  appointment_scheduled / appointment_waiting / appointment_completed ->
  profile_filled -> services_filled -> paid ->
  ready_to_apply -> visa_stage -> completed

TARGET (6 visible pipeline stages):
  New -> Contacted -> Appointment -> Complete Profile -> Submitted -> Paid
```

The internal DB values remain (backward compatibility), but they map to 6 logical stages:

| Visible Stage      | DB values grouped                                            |
|--------------------|--------------------------------------------------------------|
| New                | new, eligible, assigned                                      |
| Contacted          | contacted                                                    |
| Appointment        | appointment_scheduled, appointment_waiting, appointment_completed |
| Complete Profile   | profile_filled                                               |
| Submitted          | services_filled                                              |
| Paid               | paid (admin-only, FINAL)                                     |

Post-paid statuses (ready_to_apply, visa_stage, completed) are removed from the active pipeline. "Paid" becomes the terminal state. Existing cases in those statuses will still display as "Paid" (resolved to the Paid group).

---

## Changes Required

### 1. Pipeline Definition (caseStatus.ts + caseTransitions.ts)

**File: `src/lib/caseStatus.ts`**
- Keep all enum values (backward compat) but update `CASE_STATUS_ORDER` to end at `PAID`
- Remove `READY_TO_APPLY`, `VISA_STAGE`, `COMPLETED` from the ordered pipeline array
- Update `LEGACY_STATUS_MAP` to map `ready_to_apply`, `visa_stage`, `completed` to `PAID`

**File: `src/lib/caseTransitions.ts`**
- Set `PAID` transitions to empty array (already done, no change)
- Remove transitions FROM `PAID` to `READY_TO_APPLY` (line 14)
- Remove transitions for `READY_TO_APPLY`, `VISA_STAGE`, `COMPLETED` (lines 15-17)
- Keep `SERVICES_FILLED` transitions as empty (Paid is admin-only via edge function)

### 2. NextStepButton Safety (already partially fixed)

**File: `src/components/admin/NextStepButton.tsx`**
- Remove the `paid_at` auto-set block (lines 53-56) since Paid can never be reached via this button
- The transition map already blocks it, but this is defense-in-depth cleanup

### 3. Team Dashboard -- View All Cases

**Database: RLS policy change**
- Add a new RLS policy on `student_cases`: "Lawyers can view all active cases" with `USING (has_role(auth.uid(), 'lawyer') AND deleted_at IS NULL)`
- Keep the existing "Lawyers can update assigned cases" policy (only update own)
- Keep the existing "Lawyers can delete assigned cases" policy (only delete own)
- Add similar SELECT policy on `leads`: "Lawyers can view all non-deleted leads" so team members can see lead info for any case

**File: `src/integrations/supabase/dataService.ts`**
- In `getTeamDashboard()`: remove the `.eq('assigned_lawyer_id', userId)` filter on cases query (line 94) so team members fetch all cases (RLS now allows it)
- Keep appointments query filtered to own (`lawyer_id = userId`)

### 4. Team Dashboard -- Reassign from Any Stage

**File: `src/pages/TeamDashboardPage.tsx`**
- Currently the Reassign button only shows on appointment-stage and submitted cases
- Add the Reassign button to ALL case stages (except "Paid" final) in `renderCaseActions()`
- Reassignment already preserves stage, logs history, and does not touch financial fields -- no change needed to `handleReassignCase()`

### 5. Team Members Cannot Mark Paid or Edit Financials

**Already enforced:**
- `admin-mark-paid` edge function checks admin role server-side
- `confirmPaymentAndSubmit()` only sets `services_filled`, not `paid`
- Team dashboard has no "Mark Paid" button

**Additional safety:**
- In `renderCaseActions()`, ensure no paid-related button exists for team members (already true)
- The RLS policy "Lawyers can update assigned cases" allows case updates, but the team dashboard code never writes financial fields (service_fee, commissions, etc.) -- verify this is not exposed in any form

### 6. Admin Dashboard Consistency

**File: `src/components/admin/StudentCasesManagement.tsx`**
- Update `READY_STATUSES` (line 26) to remove `ready_to_apply`, `registration_submitted`, `visa_stage`, `completed` -- replaced by `paid` as the final filter
- Adjust to: `['profile_filled', 'services_filled', 'paid']`
- Mark Paid button already calls edge function and shows for `services_filled`/`profile_filled` only

**File: `src/components/admin/FunnelVisualization.tsx`**
- Remove stages after `paid` from `FUNNEL_STAGES` array (lines 27-29: ready_to_apply, visa_stage, completed)
- Paid becomes the final funnel stage

**File: `src/components/admin/AdminOverview.tsx`**
- Update `paidCases` filter (line 37) to just `['paid']` (remove ready_to_apply, visa_stage, completed, etc.)
- Update revenue filter (line 43) to just `['paid']`
- Remove `housingCommission` filter for `ready_to_apply` (line 47) -- no longer relevant
- Update `infRevenue` filter (line 51) to just `['paid']`

### 7. Influencer Dashboard Labels

**File: `src/pages/InfluencerDashboardPage.tsx`**
- Remove `ready_to_apply`, `visa_stage`, `completed` from `caseStatusLabels` map (lines 263-265)
- `paid` remains as the final visible status for influencers

### 8. Team Dashboard Filter Tabs Consistency

**File: `src/pages/TeamDashboardPage.tsx`**
- Update `matchesFilter` for `submitted` filter: change from `['paid', 'ready_to_apply', 'visa_stage', 'completed']` to just `['paid']`
- Update `getNeonBorder` similarly
- The "Submitted" tab will show `services_filled` cases (awaiting admin payment)
- Add a new filter or rename: "Submitted" shows `services_filled`, "Paid" shows `paid`

### 9. Reassignment Integrity Verification

Already implemented correctly:
- `handleReassignCase()` only updates `assigned_lawyer_id`, `reassigned_from`, `reassignment_notes`, `reassignment_history`
- Does NOT modify: `case_status`, `source_id`, `source_type`, commission fields
- Logs via `log_user_activity` RPC
- Influencer attribution is on `leads.source_id` -- completely separate from case assignment

---

## Database Migration (SQL)

```sql
-- Allow team members (lawyers) to VIEW all active cases
CREATE POLICY "Lawyers can view all active cases"
  ON public.student_cases
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND deleted_at IS NULL
  );

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Lawyers can view assigned cases" ON public.student_cases;

-- Allow team members to view all non-deleted leads (needed for case context)
CREATE POLICY "Lawyers can view all active leads"
  ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND deleted_at IS NULL
  );

-- Drop the old restrictive leads SELECT policy
DROP POLICY IF EXISTS "Lawyers can view leads for assigned cases" ON public.leads;
```

---

## Files Modified Summary

| File | Change |
|------|--------|
| `src/lib/caseStatus.ts` | Trim CASE_STATUS_ORDER to end at PAID; map post-paid to PAID in legacy map |
| `src/lib/caseTransitions.ts` | Remove transitions from PAID onward (ready_to_apply, visa_stage, completed) |
| `src/components/admin/NextStepButton.tsx` | Remove dead paid_at auto-set code |
| `src/integrations/supabase/dataService.ts` | Remove `assigned_lawyer_id` filter from team cases query |
| `src/pages/TeamDashboardPage.tsx` | Add Reassign button to all stages; update filter mappings for simplified pipeline |
| `src/components/admin/StudentCasesManagement.tsx` | Simplify READY_STATUSES to end at paid |
| `src/components/admin/FunnelVisualization.tsx` | Remove post-paid funnel stages |
| `src/components/admin/AdminOverview.tsx` | Update KPI filters to use only 'paid' as terminal |
| `src/pages/InfluencerDashboardPage.tsx` | Remove post-paid status labels |
| Database migration | Replace restrictive lawyer RLS with "view all active" policies |

---

## What Does NOT Change

- Lead generation logic (all 4 sources unchanged)
- Commission structure and financial formulas
- Influencer tracking and attribution (based on leads.source_id)
- The `auto_split_payment` trigger logic
- The 20-day lock and payout system
- The `admin-mark-paid` edge function
- Existing DB column structure
- Team member UPDATE/DELETE RLS (still restricted to assigned cases only)

---

## Validation Checklist

- Stage progression: New through Paid only, no skips
- Paid: only reachable via admin-mark-paid edge function
- Team members: can see all cases, can reassign any case, cannot mark paid
- Admin dashboard: funnel, overview, money tab all reference paid as terminal
- Influencer dashboard: sees simplified status labels, paid is final
- Reassignment: logs preserved, no financial impact, no stage change
- No duplicate status states possible
- No auto-movement to Paid anywhere in codebase

