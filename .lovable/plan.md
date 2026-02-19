

# Fix: Audit Log NULL admin_id Constraint Violation

## Root Cause

When a user submits the apply form (via influencer link or directly), the `insert_lead_from_apply` RPC upserts a lead. If it's an UPDATE (duplicate phone), the trigger `trg_audit_source_id_change` fires `audit_lead_source_change()`, which inserts into `admin_audit_log` using `auth.uid()` as `admin_id`. Since the apply page is public (no authentication), `auth.uid()` is NULL, violating the NOT NULL constraint on `admin_id`.

This error repeats every time someone re-submits or updates a lead from the public page.

## Fix (Database Migration)

Three changes in one migration:

1. **Make `admin_id` nullable** in `admin_audit_log` -- some auditable actions (like public form triggers) have no authenticated user.

2. **Guard `audit_lead_source_change` trigger** -- skip the INSERT when `auth.uid()` is NULL. Public apply submissions don't need source-change auditing since there's no admin performing the action.

3. **Guard `log_user_activity` function** -- add a NULL check on `auth.uid()` as a safety net, so if any unauthenticated path calls this function, it silently returns instead of crashing.

## Risk Assessment

| Change | Risk | Reason |
|--------|------|--------|
| `admin_id` DROP NOT NULL | None | Existing rows all have values; only future non-admin entries will be NULL |
| Guard trigger function | None | Only skips logging for unauthenticated users; admin actions still logged |
| Guard `log_user_activity` | None | Defensive; currently only called by authenticated users (team dashboard) |

No UI code changes needed. No RLS changes needed.

## Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_lead_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
      VALUES (auth.uid(), 'LEAD_SOURCE_CHANGED', NEW.id::text, 'leads',
        'source_id changed from ' || COALESCE(OLD.source_id::text, 'NULL')
        || ' to ' || COALESCE(NEW.source_id::text, 'NULL')
        || ' | source_type: ' || COALESCE(NEW.source_type, 'NULL'));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action text, p_target_id text DEFAULT NULL,
  p_target_table text DEFAULT NULL, p_details text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (auth.uid(), p_action, p_target_id, p_target_table, p_details);
END; $$;
```

## Verification Steps

After applying, test by submitting the apply page with an influencer ref link. The form should submit successfully without any database errors.

