
## Analysis of Current State & Issues

### What the user wants:
1. **Remove "My Cases" and "All" tabs from TeamCasesPage** — keep ONLY "Forgotten" tab view-wise (but screenshot shows My Cases / All / Forgotten — user wants to simplify to just show Forgotten + keep appointments synced)
2. **Sync appointments page** — all appointments from all cases should show
3. **Fix "Submit New Student"** — currently at `/team/submit`, needs to work properly
4. **Phase 1 FIX 1A** — unify status codes in `TeamConstants.ts`
5. **Phase 1 FIX 1B** — already done (cases table has the columns, edge fn already saves them)
6. **Phase 1 FIX 1C** — verify admin submissions page works
7. **Phase 2 FIX 2A** — already implemented (new case requires appointment)
8. **Phase 2 FIX 2B** — appointment outcomes drive case progression
9. **Phase 2 FIX 2C** — duplicate phone detection (already implemented in TeamCasesPage)

### Screenshot shows: Team Cases page with "My Cases | All | Forgotten" tabs and status filters. User says "remove My Cases and All, keep only Forgotten" — meaning they want the tabs to be just the cases list with Forgotten as a special tab. Actually re-reading: "remove my cases all and keep only forgotten" means keep the tab structure but remove the My Cases and All sub-tabs, leaving only Forgotten. But that makes no sense for a team dashboard — I think they mean the UI from the screenshot shows BOTH a top tab bar (My Cases / All / Forgotten) AND status filter buttons (All/New/Contacted/Appointment/Profile/Payment/Submitted) — they want to simplify this.

Re-reading: "remove my cases all and keep only forgotten" — I think they mean keep the Forgotten tab but remove "My Cases" and "All" from the top tab row. So the Cases page would just show all cases (which for team members is only their assigned cases anyway due to RLS) plus a Forgotten tab.

Actually looking at the screenshot more carefully: the user is showing the current state where "My Cases | All | Forgotten" tabs exist. The user wants to REMOVE "My Cases" and "All" tabs, keeping only the list + Forgotten. But practically the team member needs to see their cases — I think they want to flatten it: just show the list of cases directly (filtered by assigned_to = me by RLS), and the "Forgotten" becomes just a filter button.

**Most likely interpretation**: Remove the `TabId` concept entirely, just show the cases list with status filters. Add Forgotten as a status filter button.

### FIX 1A — TeamConstants.ts still has old status codes:
- `profile_filled` → should be `profile_completion`  
- `services_filled` → should be `submitted`
- `paid` → should be `enrollment_paid`
- `eligible`, `assigned` → should be `new`
- `appointment_waiting`, `appointment_completed` → should be `appointment_scheduled`

### Appointments sync:
The `TeamAppointmentsPage` already fetches `appointments` filtered by `team_member_id = user.id` within ±2 weeks. This is correct. But the issue may be that it uses a date range. Need to ensure all upcoming appointments show.

### Submit New Student:
The page exists at `/team/submit` (`SubmitNewStudentPage.tsx`). Looking at the code it seems functional — creates case with `enrollment_paid` status, creates `case_submissions`, uploads docs, creates student account.

## Plan

### 1. Fix `TeamConstants.ts` — canonical statuses
Update `matchesFilter()` and `getNeonBorder()` to use only canonical statuses.

### 2. Fix `TeamCasesPage.tsx` — remove "My Cases" / "All" tabs
- Remove the `TabId` concept (mine/all/forgotten)  
- Just fetch all cases where `assigned_to = user.id` OR source = manual/submit_new_student
- Add `forgotten` as just another status filter button alongside the others
- Keep the search + status filter buttons
- This simplifies the UI significantly

### 3. Fix `TeamAppointmentsPage.tsx` — show ALL appointments (not date-limited)
- Change the query to fetch all upcoming appointments (no date filter restriction, or a much wider range like -1 week to +6 months)
- Show "Outcome Required" badge on past appointments without outcome recorded

### 4. Verify `SubmitNewStudentPage.tsx` — fix any issues
- The page creates case with `enrollment_paid` status — this is correct for direct submissions
- The nav item is `nav.submitNew` at `/team/submit` — already configured
- Need to verify the edge function `create-student-from-case` exists

### Files to change:
1. `src/components/team/TeamConstants.ts` — fix canonical statuses in `matchesFilter()` and `getNeonBorder()`
2. `src/pages/team/TeamCasesPage.tsx` — simplify: remove Mine/All tabs, add forgotten as status filter
3. `src/pages/team/TeamAppointmentsPage.tsx` — show all appointments without tight date restriction

### DB migration:
- May need to update any existing cases with deprecated status values in the DB (but since we purged all cases, only admin exists, no cases to migrate)

### What NOT to change:
- `SubmitNewStudentPage.tsx` looks correct as-is
- The `DashboardLayout.tsx` nav already has `nav.submitNew` 
- `create-case-from-apply` edge function already saves all fields
- `ProfileCompletionForm` already pre-fills from case data

## Execution

**File 1: `src/components/team/TeamConstants.ts`**
- Remove `CaseFilterTab` type with `profile_filled`/`paid` 
- Update `matchesFilter()`: `profile_filled` tab → check `profile_completion`; `paid` tab → check `enrollment_paid`; `appointment_stage` → check only `appointment_scheduled`
- Update `getNeonBorder()`: remove old statuses, use canonical ones
- Rename filter tab from `profile_filled` to `profile_completion` and `paid` to `enrollment_paid`

**File 2: `src/pages/team/TeamCasesPage.tsx`**
- Remove `TabId` type (mine/all/forgotten)
- Remove the tab switcher UI
- Single query: `cases` where `assigned_to = user.id OR source IN (manual, submit_new_student)`
- Add `forgotten` to `StatusFilter` options
- Keep search + status filter pills

**File 3: `src/pages/team/TeamAppointmentsPage.tsx`**
- Remove tight date range filter (±2 weeks)
- Show all appointments for this team member (upcoming + past without outcome)
- Past appointments without outcome should show red "Record Outcome" indicator
