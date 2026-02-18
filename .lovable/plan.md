
# Financial Reset + Soft Delete System

## What Is Actually Wrong (Root Cause Analysis)

The dashboard shows **3,000 NIS pending money** despite having no active users or cases. Here is exactly why:

The `rewards` table contains 2 orphaned rows from deleted test sessions:
- `1,000 NIS` — linked to user `4e7dd70d` (profile deleted, user deleted)
- `2,000 NIS` — linked to user `7a5ab2dd` (profile deleted, user deleted)

These rewards were created when test cases were paid, but when the cases and users were cleaned up, the rewards were not cleaned up. The `MoneyDashboard` calculates pending payouts by summing ALL rewards with `status='pending'` — it has no filter for whether the owning user still exists.

There are also **2 test leads** in the database with `status='assigned'` pointing to these deleted users.

The current hard-delete logic in `LeadsManagement.handleDelete()` correctly cascades to cases, appointments, and commissions — but it **does not cancel related rewards**. This is the primary financial data integrity gap.

---

## Plan of Action

### Step 1: Clean the Database (Data Fix)

Using the data insertion tool, cancel the 2 orphaned reward records so they stop contributing to the pending total:

```sql
UPDATE rewards SET status = 'cancelled' WHERE id IN (
  'dc2caa65-8dce-4f9f-964c-9f9f37ba05c1',
  '5bf41be2-a50f-4412-84a0-78b3a3c00d7c'
);
```

Also delete the 2 test leads (hard delete is safe since there are no associated cases):
```sql
DELETE FROM leads WHERE id IN (
  '0f14121e-929e-4637-ac7a-cc83b8f26538',
  'b84a3a96-8e1b-45a5-9c87-1ea3223ea693'
);
```

After this, the dashboard should show 0 across all metrics.

---

### Step 2: Add Soft Delete to Leads and Cases (Schema Migration)

Add `deleted_at` timestamp columns to `leads` and `student_cases`. This enables soft deletes — records are hidden from all queries but the data is preserved for audit purposes.

**Migration SQL:**
```sql
-- Add soft delete to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add soft delete to student_cases  
ALTER TABLE public.student_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Update RLS policies to exclude soft-deleted records
-- Leads: admin can manage all, but non-admin views exclude deleted
DROP POLICY IF EXISTS "Admins can manage all leads" ON public.leads;
CREATE POLICY "Admins can manage all leads" ON public.leads
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Influencers can view their leads" ON public.leads;
CREATE POLICY "Influencers can view their leads" ON public.leads
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'influencer'::app_role)
    AND source_id = auth.uid()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Lawyers can view leads for assigned cases" ON public.leads;
CREATE POLICY "Lawyers can view leads for assigned cases" ON public.leads
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND id IN (SELECT get_lawyer_lead_ids(auth.uid()))
    AND deleted_at IS NULL
  );

-- student_cases: exclude deleted from non-admin views
DROP POLICY IF EXISTS "Influencers can view cases for their leads" ON public.student_cases;
CREATE POLICY "Influencers can view cases for their leads" ON public.student_cases
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'influencer'::app_role)
    AND lead_id IN (SELECT get_influencer_lead_ids(auth.uid()))
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Lawyers can view assigned cases" ON public.student_cases;
CREATE POLICY "Lawyers can view assigned cases" ON public.student_cases
  FOR SELECT TO authenticated USING (
    has_role(auth.uid(), 'lawyer'::app_role)
    AND assigned_lawyer_id = auth.uid()
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Students can view own case" ON public.student_cases;
CREATE POLICY "Students can view own case" ON public.student_cases
  FOR SELECT TO authenticated USING (
    student_profile_id = auth.uid()
    AND deleted_at IS NULL
  );
```

---

### Step 3: Fix the Delete Logic in `LeadsManagement.tsx`

The current `handleDelete()` function does cascade hard deletes but **misses rewards cancellation**. Upgrade it to:

1. Find all related cases for the lead
2. Cancel any `pending` or `approved` rewards linked to those cases (via `admin_notes` or direct lookup)
3. Soft-delete the cases by setting `deleted_at = NOW()`
4. Soft-delete the lead by setting `deleted_at = NOW()`
5. Call `onRefresh()` to trigger real-time recalculation

**Updated delete handler:**
```typescript
const handleDelete = async () => {
  if (!deleteId) return;
  setLoading(true);
  const now = new Date().toISOString();

  // 1. Find related cases
  const { data: relatedCases } = await supabase
    .from('student_cases')
    .select('id')
    .eq('lead_id', deleteId);

  if (relatedCases?.length) {
    const caseIds = relatedCases.map(c => c.id);

    // 2. Cancel rewards linked to these cases (via admin_notes pattern)
    for (const caseId of caseIds) {
      await supabase
        .from('rewards')
        .update({ status: 'cancelled' })
        .like('admin_notes', `%${caseId}%`)
        .in('status', ['pending', 'approved']);
    }

    // 3. Soft-delete the cases
    await supabase
      .from('student_cases')
      .update({ deleted_at: now })
      .eq('lead_id', deleteId);
  }

  // 4. Soft-delete the lead
  const { error } = await supabase
    .from('leads')
    .update({ deleted_at: now })
    .eq('id', deleteId);

  if (error) {
    toast({ variant: 'destructive', title: t('common.error'), description: error.message });
  } else {
    toast({ title: t('admin.leads.deleted') });
    onRefresh();
  }
  setLoading(false);
  setDeleteId(null);
};
```

---

### Step 4: Filter Deleted Records from All Dashboard Queries

Update `dataService.ts` to exclude soft-deleted records from all admin queries:

```typescript
// In getAdminDashboard():
safeQuery((supabase as any).from('leads').select('*').is('deleted_at', null).order('created_at', { ascending: false })),
safeQuery((supabase as any).from('student_cases').select('*').is('deleted_at', null).order('created_at', { ascending: false })),
```

---

### Step 5: Fix `MoneyDashboard` — Exclude Cancelled Rewards from Pending Total

The `pendingPayouts` KPI currently sums ALL rewards with `status='pending'` or `status='approved'`. It must exclude `cancelled` rewards (which it already does by filtering for those statuses), but also the underlying data must be clean (fixed in Step 1).

Also update `MoneyDashboard` to only count cases where `deleted_at IS NULL` — since cases are passed in from `dataService`, this is automatically handled once Step 4 is done. No code change needed in `MoneyDashboard` itself beyond passing clean data.

---

### Step 6: Update `LeadsManagement` Filter to Exclude Soft-Deleted Leads

Since the admin can see deleted records (per RLS admin policy), the frontend filter must explicitly exclude them from the displayed list:

```typescript
const filtered = leads.filter(l => {
  if (l.deleted_at) return false; // Exclude soft-deleted
  const matchSearch = ...
  ...
});
```

---

## Summary of Changes

| Area | What Changes | Why |
|---|---|---|
| Database (data) | Cancel 2 orphaned reward rows, delete 2 test leads | Immediate fix for 3,000 NIS ghost value |
| Database (schema migration) | Add `deleted_at` to `leads` and `student_cases`, update RLS policies | Enable soft delete |
| `dataService.ts` | Add `.is('deleted_at', null)` filters to leads and cases queries | Exclude soft-deleted from all dashboards |
| `LeadsManagement.tsx` | Upgrade `handleDelete` to soft-delete + cancel rewards | Prevent future orphaned financial data |
| `LeadsManagement.tsx` | Add `deleted_at` check in frontend filter | Hide soft-deleted from admin list view |

## Expected Result After Fix

- Pending money: **0 NIS**
- Revenue: **0 NIS**
- Active leads: **0**
- Active cases: **0**
- All financial numbers dynamically derived from live, non-deleted data
- Future lead/case deletions will automatically zero-out their financial contributions
