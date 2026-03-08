
## Audit: Data Reset Function — Findings

### What it does (correctly)
1. Admin selects categories → checks row counts → enters password → confirms → deletes
2. Password re-auth using `supabase.auth.signInWithPassword` ✅
3. Audit log written after purge ✅
4. State cleared after success ✅

---

### Issues Found (3 bugs that will break or silently fail)

#### Bug 1 — CRITICAL: `case_submissions` deletion order causes FK violation
The reset deletes tables **in the order defined in `RESET_CATEGORIES`**:
```
cases → case_submissions → case_service_snapshots
```
`case_submissions` has a FK: `case_id → cases.id ON DELETE CASCADE`. So when the code tries to delete `cases` first, it will work. But the code loops `selectedTables` which is `["cases", "case_submissions", "case_service_snapshots"]` and calls `.delete()` on each. The problem is the opposite: if admin selects ONLY `cases` category, the code sends:
- DELETE from `cases` → **triggers CASCADE on `case_submissions`** ✅ (OK)
- DELETE from `case_submissions` → already gone, no error ✅

Actually this direction is fine. But `case_service_snapshots` has no FK to `cases` in the current schema (it has `case_id` referencing `student_cases`, not `cases`). The reset code targets `cases` table but this is the **`cases`** table (from the pipeline), not `student_cases`. The `RESET_CATEGORIES` definition lists `["cases", "case_submissions", "case_service_snapshots"]` but `case_service_snapshots.case_id` references `student_cases.id`, not `cases.id`. This is a table mismatch — deleting `cases` won't cascade to `case_service_snapshots`.

#### Bug 2 — CRITICAL: `activity_log` has NO DELETE RLS policy
Migration shows only:
- `FOR SELECT` — admin can read ✅  
- `FOR INSERT` — system can insert ✅
- **No `FOR DELETE` policy** — admin DELETE will be silently rejected (returns 0 rows, no error from Supabase)

The reset silently fails for the "Activity Log" category.

#### Bug 3 — MODERATE: `rewards` and `commissions` delete will fail silently due to missing admin DELETE RLS
Looking at the schema:
- `rewards` RLS: `SELECT` (own), `UPDATE` (own cancellation) — **no admin DELETE** ❌
- `commissions` RLS: `ALL` for admin ✅

The `rewards` table will silently return 0 deleted rows when the admin tries to reset "Financial Records" — the `payout_requests` has no admin policy at all (only user self-policies).

#### Bug 4 — MINOR: Deletion order matters for `payout_requests`
`payout_requests` links to `rewards` via `linked_reward_ids` (array, not FK). Safe to delete in any order.

---

### Fix Plan (migrations + CSS-only)

#### 1. Add missing RLS DELETE policies (database migration)
```sql
-- activity_log: admin delete
CREATE POLICY "Admins can delete activity"
  ON public.activity_log FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- rewards: admin full access  
CREATE POLICY "Admins can manage rewards"
  ON public.rewards FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- payout_requests: admin full access
CREATE POLICY "Admins can manage payout requests"
  ON public.payout_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
```

#### 2. Fix `RESET_CATEGORIES` — remove non-existent `case_submissions` table reference (it cascades from `cases` automatically) and fix the `case_service_snapshots` to target `student_cases` table instead
In `AdminSettingsPage.tsx`, line 79:
```tsx
// Before
{ id: "cases", ..., tables: ["cases", "case_submissions", "case_service_snapshots"] }

// After  
{ id: "cases", ..., tables: ["cases", "case_service_snapshots"] }
// case_submissions cascades from cases (ON DELETE CASCADE)
// case_service_snapshots links to student_cases — keep it but note it's separate
```

Actually `case_service_snapshots.case_id` → `student_cases.id`, and `student_cases` is a separate table from `cases`. These are two separate tables. The "cases" category should only target `cases` + `case_submissions` (cascade). The `case_service_snapshots` should be in a separate category or moved to be alongside `student_cases`. But `student_cases` is NOT in any reset category — it's a separate flow. I'll remove `case_service_snapshots` from the `cases` category and add it under a note that it belongs to the `student_cases` flow (not `cases` table).

#### 3. Fix deletion order in `handleDataReset`
Delete child tables before parents to avoid FK constraint errors. The correct order:
```
case_submissions → cases (submissions reference cases)  
```
But since `case_submissions` CASCADE deletes when `cases` is deleted, we should delete `case_submissions` first OR just rely on CASCADE. Currently the code does `cases` first which triggers cascade (deletes `case_submissions`), then tries to delete `case_submissions` again (already gone — no-op). This is actually fine in Postgres but wasteful.

The real fix is ensuring the correct deletion order is enforced by sorting `selectedTables` to put dependent tables before parent tables.

---

### Summary of changes
| What | Where | Type |
|---|---|---|
| Add admin DELETE policy on `activity_log` | Migration | DB |
| Add admin ALL policy on `rewards` | Migration | DB |
| Add admin ALL policy on `payout_requests` | Migration | DB |
| Remove invalid `case_submissions` from categories (cascades) | `AdminSettingsPage.tsx` line 79 | Code |
| Remove `case_service_snapshots` from cases category (wrong FK) | `AdminSettingsPage.tsx` line 79 | Code |
| Sort deletion order: child tables first | `AdminSettingsPage.tsx` handleDataReset | Code |
