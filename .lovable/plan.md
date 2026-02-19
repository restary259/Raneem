
# Fix: Assigned Leads Not Appearing in Team Member Dashboards

## Root Cause (Confirmed via Database Evidence)

**Every single `student_cases` row has `deleted_at` set (non-NULL).** This means team members see ZERO cases.

Evidence from database query -- all 4 assigned cases:

| Case ID | assigned_lawyer_id | case_status | deleted_at |
|---------|-------------------|-------------|------------|
| 090ba31d | 644a94f2 | paid | 2026-02-19 20:29:21 |
| b70bd6aa | b80a72a1 | assigned | 2026-02-19 15:35:27 |
| 26c61b1f | b80a72a1 | paid | 2026-02-18 23:28:50 |
| 55561d25 | 644a94f2 | paid | 2026-02-18 23:28:52 |

The RLS policy for team members explicitly requires `deleted_at IS NULL`:

```
Lawyers can view assigned cases
USING: has_role(auth.uid(), 'lawyer') AND assigned_lawyer_id = auth.uid() AND deleted_at IS NULL
```

Since ALL cases have `deleted_at` set, team members see nothing. The admin sees them because their RLS policy is unrestricted (`ALL` command).

**Why this happens**: The admin's `assignLawyer` function (LeadsManagement.tsx, line 207-242) finds existing soft-deleted cases and updates their `assigned_lawyer_id` but **never clears `deleted_at`**. Same issue as the leads bug we just fixed -- the soft-delete flag persists through re-assignment.

---

## Fix (Two Parts)

### Part 1: Code Fix -- Clear `deleted_at` on Assignment (LeadsManagement.tsx)

In the `assignLawyer` function, add `deleted_at: null` when updating an existing case (line 213-217):

```typescript
// BEFORE (line 213-217):
await supabase.from('student_cases').update({
  assigned_lawyer_id: selectedLawyer,
  assigned_at: new Date().toISOString(),
  ...(assignNotes.trim() ? { admin_notes: assignNotes.trim() } : {}),
}).eq('id', existingCases[0].id);

// AFTER:
await supabase.from('student_cases').update({
  assigned_lawyer_id: selectedLawyer,
  assigned_at: new Date().toISOString(),
  deleted_at: null,  // Restore if previously soft-deleted
  ...(assignNotes.trim() ? { admin_notes: assignNotes.trim() } : {}),
}).eq('id', existingCases[0].id);
```

Also in `markEligible` (line 140-152): when an existing case is found but was soft-deleted, restore it:

```typescript
if (existingCases?.[0]) {
  // Restore if previously soft-deleted
  await supabase.from('student_cases').update({ deleted_at: null }).eq('id', existingCases[0].id);
}
```

### Part 2: Data Fix -- Restore All Active Cases

Clear `deleted_at` on all cases that are actively assigned (have a lawyer and are not intentionally archived):

```sql
UPDATE student_cases 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL 
  AND assigned_lawyer_id IS NOT NULL;
```

This immediately makes all 4 existing cases visible to their assigned team members.

---

## Why This Fully Solves the Problem

1. **Immediate visibility**: Data fix restores all existing cases for team members
2. **Future-proof**: Code fix ensures new assignments always clear `deleted_at`
3. **RLS passes**: With `deleted_at = NULL`, the lawyer RLS policy (`deleted_at IS NULL`) allows SELECT
4. **Realtime works**: The `useRealtimeSubscription('student_cases', refetch)` in TeamDashboardPage already listens for changes -- once RLS allows access, refetch returns the data
5. **No RLS changes needed**: Policies are correct; the data was wrong

## Risk Assessment

| Change | Risk | Reason |
|--------|------|--------|
| Add `deleted_at: null` to assignment update | None | Active assignment should always clear soft-delete |
| Restore existing cases via data fix | Low | Only affects cases with active lawyer assignments |
| No RLS policy changes | None | Policies are already correct |

## Verification Plan

After applying:
1. Log in as team member (lawyer role) -- should see assigned cases immediately
2. As admin, assign a new lead to a team member -- team member should see it in real-time
3. Soft-delete a case, then re-assign it -- should reappear for team member
4. Confirm influencer dashboard still shows linked cases correctly
