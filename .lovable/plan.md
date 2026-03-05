
## Analysis of Current State

### What's Already Done (No Changes Needed):
- **TeamCasesPage**: Already uses `.select('*')` relying on RLS. Already has all canonical status filters. Already has `forgotten` filter. No "All Cases" / "Unassigned" tabs.
- **TeamTodayPage**: Already uses `.eq('assigned_to', user.id)` on cases query. ✅
- **TeamAnalyticsPage**: Already uses `.eq('assigned_to', user.id)`. ✅
- **TeamStudentsPage**: Already uses `.eq('assigned_to', user.id)`. ✅
- **RLS on cases table**: Already has `"Team can manage assigned cases"` policy restricting to `assigned_to = auth.uid() OR source IN ('manual','submit_new_student')`. ✅
- **AdminPipelinePage**: Already shows `assignee_name` via `profileMap`, already shows phone, already has SLA stale detection with AlertTriangle, already has assign dropdown with team members from DB. ✅

### What Actually Needs Fixing:

**FIX 3A — TeamCasesPage RLS issue:**
The RLS policy allows team members to see ALL `source = 'manual'` or `source = 'submit_new_student'` cases, not just ones they created. This is a bug: a team member could see another team member's manually-created cases. The RLS `WITH CHECK` should restrict inserts/updates, but the `USING` expression lets any team_member see ANY manually-created case. This needs fixing: restrict `source IN (...)` to only their own created cases OR simply remove the source exception and rely purely on `assigned_to = auth.uid()`.

Fix: Update RLS to `assigned_to = auth.uid()` ONLY, since manual cases are created with `assigned_to: user!.id` already.

**FIX 3B — TeamStudentsPage logic is wrong per spec:**
Current page shows `profile_completion, payment_confirmed, submitted` as "Ready to Apply" and `enrollment_paid` as "Enrolled". Per spec, "My Students" should show ONLY `submitted` and `enrollment_paid`. Cases in `profile_completion` and `payment_confirmed` are still active pipeline stages. Need to:
- Remove the tabs entirely or rename them
- Show only `status IN ('submitted', 'enrollment_paid')`
- Show "Awaiting Admin Processing" label for `submitted`
- Show "Enrolled ✓" green badge for `enrollment_paid`
- Add `updated_at` as "date submitted" column (or `last_activity_at`)

**FIX 3C — AdminPipelinePage cards are missing:**
- Source badge (apply_page / contact_form / manual) is NOT shown on cards — needs to be added
- Unassigned badge in RED when no assignee (currently the dropdown shows "Unassigned" but no red badge)
- The card layout needs: name + phone + assignee name/badge + days + source + SLA indicator

**Migration needed:**
- Update RLS: drop the `source IN ('manual', 'submit_new_student')` exception, keep only `assigned_to = auth.uid()`

## Plan

### 1. DB Migration — Fix RLS on cases for team_member
```sql
DROP POLICY IF EXISTS "Team can manage assigned cases" ON public.cases;
CREATE POLICY "Team can manage assigned cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'team_member'::app_role) AND assigned_to = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'team_member'::app_role)
  );
```

### 2. Update `TeamStudentsPage.tsx`
- Remove the "Ready to Apply" / "Enrolled" tabs
- Single query: `status IN ('submitted', 'enrollment_paid')` WHERE `assigned_to = user.id`
- Display columns: student name, phone, status badge, date (last_activity_at), program interest (degree_interest)
- `submitted` → badge: "Awaiting Admin Processing" (indigo)
- `enrollment_paid` → badge: "Enrolled ✓" (green)
- No tabs — just a flat list sorted by last_activity_at desc

### 3. Update `AdminPipelinePage.tsx`
- Add source badge on each card (color-coded: apply_page=blue, manual=gray, contact_form=yellow)
- Show assignee name below phone on each card (or "Unassigned" in red if no assignee)
- The stale logic already exists — just change `border-destructive/50` to differentiate: new>3d = red border, contacted>5d = orange border

### Files Changed:
| File | Change |
|------|--------|
| `supabase/migrations/` | Fix RLS: remove source exception, keep only `assigned_to = auth.uid()` |
| `src/pages/team/TeamStudentsPage.tsx` | Show only submitted + enrollment_paid, remove tabs, add proper labels |
| `src/pages/admin/AdminPipelinePage.tsx` | Add source badge + assignee name/red-unassigned badge on cards |

### No changes needed:
- `TeamCasesPage.tsx` — already correct
- `TeamTodayPage.tsx` — already correct
- `TeamAnalyticsPage.tsx` — already correct
- `CaseDetailPage.tsx` — already correct (no .eq filter needed since case detail is accessed by ID)
