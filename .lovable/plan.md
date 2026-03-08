

## Problem
`إدارة الطلاب` (AdminStudentsPage) currently shows **all** profiles with the `student` role, including students that were auto-created when a case was submitted (via `create-case-from-apply` or `create-student-account`). The user only wants to see **manually provisioned** student accounts — i.e. accounts created by admins or team members using the "Create Student Account" flow.

## Root Cause
In `fetchStudents()` (line 286–328), the query fetches all profiles where the user has the `student` role with no filter on `created_by`. The filter `.not("created_by","is",null)` was **intentionally removed** previously (comment on line 306 says "those were hiding valid students"), but this is now the correct filter to re-add for this page's specific purpose.

## The Fix
**One change — add a single filter** in the `fetchStudents` query in `AdminStudentsPage.tsx`:

```typescript
.not("created_by", "is", null)   // Only show manually-created accounts
```

This filters to only profiles where `created_by IS NOT NULL`, which means:
- ✅ Accounts created by admin via "Create Student Account" button → **shown** (they have `created_by` = admin/team UUID)
- ✅ Accounts created by team members via "Create Student from Case" → **shown** (same)  
- ❌ Profiles created by the apply page or contact form with no provisioner → **hidden**
- ❌ Self-registered students with no manual creator → **hidden**

Both `create-student-standalone` and `create-student-from-case` edge functions always set `created_by: callerId` (line 113 and 194 respectively), so this is the reliable signal.

## File to change: 1

**`src/pages/admin/AdminStudentsPage.tsx`** — line 305-307:

Change:
```typescript
const { data: profileData, error } = await supabase
  .from("profiles")
  .select(PROFILE_SELECT)
  .in("id", userIds)
  // Removed .not("created_by","is",null) and .is("case_id",null) — those were hiding valid students
  .order("created_at", { ascending: false });
```

To:
```typescript
const { data: profileData, error } = await supabase
  .from("profiles")
  .select(PROFILE_SELECT)
  .in("id", userIds)
  .not("created_by", "is", null)   // Only manually-provisioned accounts
  .order("created_at", { ascending: false });
```

No DB migration needed. No money logic touched.

