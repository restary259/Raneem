# Fix: Soft-Deleted Leads Not Clearing on Re-submission

## Root Cause

The `insert_lead_from_apply` RPC function upserts leads by phone number. When a lead is re-submitted with a phone that already exists (even if that lead was previously soft-deleted by an admin), the UPDATE branch runs but **does not reset `deleted_at` to NULL**.

Evidence from the database:

- Lead "Helal" was soft-deleted on Feb 18 (`deleted_at: 2026-02-18 23:28:52`)
- Re-submitted on Feb 19 (`created_at: 2026-02-19 20:35:50`) via influencer link
- `deleted_at` was NOT cleared, so it stays invisible
- The admin dashboard query filters with `.is('deleted_at', null)`, hiding these leads

This affects ALL re-submissions (influencer or organic) where the phone number was previously used and the lead was soft-deleted.

## Fix (Database Migration)

Update the `insert_lead_from_apply` function to add `deleted_at = NULL` in the UPDATE clause. This ensures that when a lead is re-submitted, any previous soft-delete is cleared and the lead becomes visible again.

## Technical Details

One line added to the UPDATE statement inside `insert_lead_from_apply`:

```sql
CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(...)
-- In the UPDATE leads SET ... clause, add:
--   deleted_at = NULL,
-- right after the existing field assignments
```

Specifically, the UPDATE block changes from:

```sql
UPDATE leads
SET full_name = p_full_name, passport_type = p_passport_type,
    english_units = p_english_units, math_units = p_math_units,
    ...
    status = v_status, preferred_major = p_preferred_major, created_at = now()
WHERE phone = p_phone
```

To:

```sql
UPDATE leads
SET full_name = p_full_name, passport_type = p_passport_type,
    english_units = p_english_units, math_units = p_math_units,
    ...
    status = v_status, preferred_major = p_preferred_major, created_at = now(),
    deleted_at = NULL
WHERE phone = p_phone
```

Additionally, a one-time data fix will clear `deleted_at` on leads that were re-submitted after being soft-deleted (where `created_at > deleted_at`), making them immediately visible in the admin dashboard.

```sql
UPDATE leads SET deleted_at = NULL
WHERE deleted_at IS NOT NULL AND created_at > deleted_at;
```

## Risk Assessment


| Change                            | Risk | Reason                                                                    |
| --------------------------------- | ---- | ------------------------------------------------------------------------- |
| Add `deleted_at = NULL` to UPDATE | None | Correct behavior -- re-submission means the lead is active again          |
| Data fix for existing leads       | Low  | Only affects leads where `created_at > deleted_at` (already re-submitted) |


No UI code changes needed. No RLS changes needed.

## Verification

After applying, all previously "ghost" leads (like Helal, Test Influencer Link 02, etc.) will immediately appear in the admin Leads tab. Future re-submissions via any source (influencer or organic) will correctly clear the soft-delete flag.          TARGETED INVESTIGATION PLAN

**Issue: Influencer Apply Submissions Do Not Appear in Admin**

---

# PHASE 1 — Confirm Both Flows Use the Same RPC

### Step 1: Verify Entry Point

Confirm that:

- Normal Apply Page
- Influencer Apply Page

Both call:

`insert_lead_from_apply` (same RPC, same parameters)

Have him:

- Search project for `insert_lead_from_apply`
- Confirm influencer page does NOT call a different function
- Confirm no conditional branch like:

```
if (influencerId) {
   insertInfluencerLead()
}

```

If they are different → stop. That’s the root cause.

---

# PHASE 2 — Log Insert Behavior

Add logging to both flows:

```
console.log("Calling RPC with:", payload)

```

After execution:

```
console.log("RPC response:", data, error)

```

We need to confirm:

- Is the RPC returning success?
- Is it updating instead of inserting?
- Is error null?

---

# PHASE 3 — Direct Database Inspection

Immediately after influencer submission:

Go to database table manually.

Search by phone number.

Confirm:

- Does row exist?
- Does created_at update?
- Does influencer_id exist?
- What is deleted_at value?

If:

`deleted_at IS NOT NULL`

→ His soft-delete theory is correct.

If:

Row does not exist

→ Insert failing.

If:

Row exists but missing influencer_id

→ Attribution bug.

---

# PHASE 4 — Validate Soft Delete Theory

To confirm definitively:

1. Take a phone number that has NEVER existed.
2. Submit via influencer link.
3. Check if it appears.

If new phone appears →  
Bug only affects reused numbers → confirms his diagnosis.

If new phone does NOT appear →  
Different issue.

---

# PHASE 5 — Validate Admin Query

Check admin dashboard query:

Is it:

```
.is('deleted_at', null)

```

Confirm influencer rows are excluded because of deleted_at.

Have him temporarily remove that filter and reload.

If influencer leads appear → confirmed.

---

# PHASE 6 — Validate Upsert Logic

Open `insert_lead_from_apply` function.

Check if it does:

```
UPDATE leads
SET ...
WHERE phone = p_phone

```

But does NOT reset deleted_at.

If yes → confirmed.

---

# PHASE 7 — Confirm Influencer ID Behavior

Inside UPDATE branch confirm:

- influencer_id is being set
- It does not skip updating influencer_id
- No condition preventing influencer update

Because sometimes update clause misses that field.

---

# PHASE 8 — After Fix Validation Checklist

After adding:

```
deleted_at = NULL

```

Run this test:

### Test A — Fresh Phone

- Submit via influencer
- Must appear

### Test B — Deleted Phone

- Soft delete
- Resubmit
- Must appear immediately

### Test C — Normal Flow

- Submit same phone
- Must appear

### Test D — Influencer Attribution

- Confirm influencer_id saved
- Confirm influencer dashboard updates
- Confirm commission calculated

---

# ⚠️ Important Risk Check

Ask him to confirm:

- Does clearing deleted_at reopen historical leads?
- Does commission duplicate?
- Does system double count re-submissions?

We don’t want inflated influencer stats.

---

# 🎯 Decision Tree

If:

✔ Only reused numbers fail  
✔ deleted_at is not null  
✔ Update branch missing reset

→ His fix is correct.

If:

✖ Fresh influencer submissions also fail  
→ There is a deeper logic split.

---

# 🧠 Strategic Note

Since this affects only influencer apply:

There is a strong possibility of:

- A missing parameter
- Different RPC call
- Missing influencer_id update
- Different status default

Do not assume. Validate each phase.