
## Root Cause

The error is **not** in the edge function code itself. It is in the **database trigger** `log_case_status_change` that fires automatically whenever `cases.status` is updated.

The trigger does:
```sql
COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
```

When the edge function updates the case using the **service role** key, `auth.uid()` returns `NULL` (service role has no user session). So the fallback UUID `00000000-0000-0000-0000-000000000000` is used. This UUID does **not exist** in `auth.users`, which violates the FK constraint `activity_log.actor_id REFERENCES auth.users(id)`.

Because `actor_id` is already defined as nullable with `ON DELETE SET NULL`, the correct fix is to simply use `NULL` when `auth.uid()` is null — not a fake UUID.

The previous "fix" wrapped the explicit `log_activity` RPC call in try/catch — but the **trigger** fires implicitly as part of the `UPDATE cases SET status = 'enrollment_paid'` query and it's **inside the same transaction**, so the FK failure bubbles up and kills the entire operation.

## Fix

**One migration**: Update the `log_case_status_change` trigger function to use `NULL` instead of the fake nil UUID:

```sql
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),   -- NULL is fine — column is nullable (FK ON DELETE SET NULL)
      'system',
      'status_changed_to_' || NEW.status,
      'case',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**No other changes needed.** The `admin-mark-paid` edge function code is correct — the try/catch blocks around explicit logging are fine too. The money logic (`record_case_commission` RPC), the `enrollment_paid` status transition, and all `case_submissions` updates are untouched.

## Why this is safe

- `actor_id` is `UUID REFERENCES auth.users(id) ON DELETE SET NULL` — nullable by design
- Inserting `NULL` for `actor_id` is valid and already how the column was intended to work for system/service-role operations
- All existing audit log rows with real user IDs are unaffected
- The `log_activity` RPC function also inserts `actor_id` directly — it is called with the actual `user.id` from the token, which is a real auth user, so that path is fine

## Files to change: 1 migration

Create `supabase/migrations/<timestamp>_fix_activity_log_trigger.sql`:
```sql
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'system',
      'status_changed_to_' || NEW.status,
      'case',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

That is the **complete fix**. One function replacement. No data loss, no money logic change.
