-- ════════════════════════════════════════════════════════════════════════
-- G4 — Attribution lock after commission is recorded
-- ════════════════════════════════════════════════════════════════════════
-- Once `cases.commission_split_done = true`, the case's attribution columns
-- (partner_id / referred_by) are FROZEN for non-admin callers. An admin can
-- still override (e.g. to correct a mis-attribution), but the override is
-- logged as an `attribution_override_after_commission` case event so the
-- change is auditable — a silent re-attribution after rewards were paid would
-- let an admin move a paid case to a different partner without a trace.
--
-- This is ADDITIVE to `restrict_cases_financial_columns` (which gates WHO can
-- change attribution: only admins). That trigger already blocks non-admins
-- from touching partner_id/referred_by at ANY time. This new trigger adds the
-- POST-COMMISSION concern: it gates WHETHER attribution can change once the
-- split is done, and logs admin overrides. The two concerns are orthogonal:
--   - restrict_cases_financial_columns: permission (admin-only) — runs first.
--   - guard_case_attribution_lock:      immutability + audit — runs after.
-- (Both are BEFORE UPDATE; order is alphabetical by trigger name. Either
--  raising is sufficient to abort the UPDATE.)
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_case_attribution_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_jwt_role text;
  v_actor uuid;
BEGIN
  -- Only relevant once the commission split has been recorded.
  IF OLD.commission_split_done IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- Only when attribution actually changes.
  IF NEW.partner_id IS NOT DISTINCT FROM OLD.partner_id
     AND NEW.referred_by IS NOT DISTINCT FROM OLD.referred_by THEN
    RETURN NEW;
  END IF;

  -- Trusted internal writer (commission-split escape hatch / edge functions).
  -- The restrict_cases_financial_columns trigger already authorizes these, and
  -- they never re-attribute post-commission in practice.
  IF COALESCE(current_setting('app.internal_commission_split', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END IF;

  v_actor := auth.uid();
  v_is_admin := public.has_role(v_actor, 'admin'::app_role)
    OR v_jwt_role = 'service_role'
    OR session_user IN ('service_role', 'postgres', 'supabase_admin');

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'ATTRIBUTION_LOCKED: partner_id / referred_by cannot be changed after commission is recorded. An admin must override and the change will be audited.';
  END IF;

  -- Admin override: log it so the change is auditable.
  PERFORM public.log_case_event(
    NEW.id,
    'attribution_override_after_commission',
    jsonb_build_object(
      'actor_id', v_actor,
      'old_partner_id', OLD.partner_id,
      'new_partner_id', NEW.partner_id,
      'old_referred_by', OLD.referred_by,
      'new_referred_by', NEW.referred_by
    ),
    true
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_case_attribution_lock() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_case_attribution_lock() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_guard_case_attribution_lock ON public.cases;
CREATE TRIGGER trg_guard_case_attribution_lock
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.guard_case_attribution_lock();
