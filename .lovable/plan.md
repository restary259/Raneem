
## Full Scan Results

### Task 1 — Student Account Visibility Isolation

#### What I found in the RLS policies on `profiles`:

There are **two conflicting policies** that both apply to team members reading student profiles:

**Policy A — "Team members can view students they created"** ✅ CORRECT
```sql
USING (created_by = auth.uid() AND (has_role(auth.uid(), 'team_member') OR has_role(auth.uid(), 'admin')))
```
This correctly restricts team members to only see students they created.

**Policy B — "Team can view student profiles"** ❌ BROKEN — leaks all students
```sql
USING (has_role(auth.uid(), 'team_member') AND EXISTS (
  SELECT 1 FROM user_roles WHERE user_roles.user_id = profiles.id AND user_roles.role = 'student'
))
```
This allows **any** team member to see **all** student profiles. Because Postgres RLS uses PERMISSIVE policies with OR logic, if either policy matches, the row is visible. Policy B completely bypasses the `created_by` restriction from Policy A.

**Result:** A team member can see every single student in the system — not just those they created. This is a data isolation bug.

**Admin policy** — "Admins can view all profiles": `USING (has_role(auth.uid(), 'admin'))` ✅ correct, admin sees all.

#### Frontend query analysis:
- `TeamStudentsPage.tsx` line 82-88: Queries `profiles` with `.not("created_by", "is", null).is("case_id", null)` — but this is **just a frontend filter**, not a security boundary. Since Policy B lets any team member read all students, the RLS already returns all, and the frontend then filters client-side. If RLS were fixed, this frontend filter would be fine as an added UI filter.
- `AdminStudentsPage.tsx` line 289-309: Queries without `created_by` filter — correct for admin, but admin also hits Policy B which is redundant (admin already bypasses via their own policy).

#### Fix needed:
Drop Policy B ("Team can view student profiles") — it contradicts and overrides the correct isolation policy. Policy A + Admin policy together give the correct behavior:
- Team members: see only rows where `created_by = auth.uid()`
- Admins: see all rows

---

### Task 2 — Admin Delete Edge Function (selective-delete)

#### What I found:

**Auth check** ✅ CORRECT — Line 56-64: checks `user_roles` for `role = 'admin'`, returns 403 if not.

**Cascade deletion** ⚠️ PARTIAL — Hard delete does:
- documents → `supabase.from("documents").delete().eq("student_id", student_id)` ✅
- case_submissions → manually deletes linked to cases ✅  
- cases → deletes by `student_user_id` ✅
- auth user → `supabaseAdmin.auth.admin.deleteUser(student_id)` ✅
- BUT: `visa_applications`, `referrals`, `rewards`, `services`, `payments`, `appointments` (via cases) are NOT explicitly deleted before the auth user is deleted. Since auth user deletion cascades via FK to `profiles`, and these tables reference `student_id` (profiles.id) — whether they cascade depends on FK constraints. Need to verify.

**ACTIVE BUG** ❌ — Line 220-229: `supabaseAdmin.rpc(...).catch is not a function`
```typescript
await supabaseAdmin
  .rpc("log_activity", { ... })
  .catch(() => {}); // ← This is wrong syntax in Deno/Supabase JS v2
```
The Supabase JS v2 `rpc()` returns a `PostgrestSingleResponse`, not a Promise with `.catch()`. This throws `TypeError` and the entire edge function crashes — meaning **no delete is completed and a 500 is returned every time it's called**.

The fix is: `try { await supabaseAdmin.rpc(...) } catch {}` or wrap in try/catch.

**Success/error responses** ✅ CORRECT — Returns `{ success: true, mode, deleted, message }` on success, `{ error: "..." }` with appropriate status codes.

---

## Summary of Issues

| # | Location | Issue | Severity |
|---|---|---|---|
| 1 | RLS: `profiles` → "Team can view student profiles" | PERMISSIVE policy lets all team members see all student profiles, defeating isolation | **Critical** |
| 2 | `selective-delete/index.ts` line 220 | `.rpc(...).catch()` is invalid syntax — crashes function before any delete runs | **Critical** |
| 3 | `selective-delete/index.ts` hard delete | `visa_applications`, `referrals`, `rewards`, `services`, `payments` not explicitly cleaned before auth user delete | **Moderate** |

---

## Plan

### Fix 1 — DB Migration: Drop the leaking RLS policy
```sql
DROP POLICY IF EXISTS "Team can view student profiles" ON public.profiles;
```
After this, team members only match Policy A (`created_by = auth.uid()`). Admins still see all via their own policy. This is the only change needed at the DB level.

### Fix 2 — `selective-delete/index.ts`: Fix the `.catch()` crash
Replace:
```typescript
await supabaseAdmin.rpc("log_activity", { ... }).catch(() => {});
```
With:
```typescript
try { await supabaseAdmin.rpc("log_activity", { ... }); } catch {}
```

### Fix 3 — `selective-delete/index.ts`: Add missing cascade cleanup in hard delete
Before deleting the auth user, explicitly delete:
- `visa_applications` WHERE `student_user_id = student_id`
- `referrals` WHERE `referrer_user_id = student_id`  
- `rewards` WHERE `user_id = student_id`
- `services` WHERE `student_id = student_id`
- `payments` WHERE `student_id = student_id`
- `appointments` (via cases) — already handled since cases are deleted first

### Files changed
| File | Change |
|---|---|
| New DB migration | `DROP POLICY "Team can view student profiles" ON profiles` |
| `supabase/functions/selective-delete/index.ts` | Fix `.catch()` crash + add missing hard delete cascade steps |

### What was already correct
- Policy A (`created_by = auth.uid()`) is correctly written ✅
- Admin bypass policy is correct ✅
- `create-student-standalone` correctly sets `created_by = callerId` in the profile ✅
- `selective-delete` auth check (admin-only 403 guard) is correct ✅
- `selective-delete` password re-verification for hard delete is correct ✅
- Deletion log snapshot before destructive action is correct ✅
