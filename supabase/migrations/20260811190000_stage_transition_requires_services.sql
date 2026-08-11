-- Guard profile_completion -> payment_confirmed so a case can never reach the
-- paid stage with zero DARB services on file. The confirm_agency_service_payment
-- RPC already refuses to confirm a zero total, but the stage-transition trigger
-- accepted a direct status UPDATE (admin or service_role) with no services,
-- which is how DRB-2026-000033 reached payment_confirmed with an empty
-- case_services and no invoice.
--
-- The trigger inlines the same SUM(unit_price * quantity - discount) the
-- finance RPCs use, so the trigger and the RPCs can never disagree about what
-- "positive" means. It does not call get_case_darb_service_total() because that
-- helper is auth-bound and the trigger must validate data, not callers.

CREATE OR REPLACE FUNCTION public.enforce_case_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appts int;
  v_pending int;
  v_profile_done timestamptz;
  v_paid boolean;
  v_review text;
  v_service_total numeric;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions) and cancellation are always allowed.
  IF auth.role() = 'service_role' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('new', 'forgotten') AND NEW.status = 'contacted' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'contacted' AND NEW.status = 'appointment_scheduled' THEN
    SELECT count(*) INTO v_appts FROM public.appointments WHERE case_id = NEW.id;
    IF v_appts = 0 THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: an appointment must be scheduled first';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'appointment_scheduled' AND NEW.status IN ('contacted', 'forgotten') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'appointment_scheduled' AND NEW.status = 'profile_completion' THEN
    SELECT count(*) INTO v_appts FROM public.appointments WHERE case_id = NEW.id;
    SELECT count(*) INTO v_pending FROM public.appointments WHERE case_id = NEW.id AND outcome IS NULL;
    IF v_appts = 0 OR v_pending > 0 THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: record every appointment outcome first';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'profile_completion' AND NEW.status = 'payment_confirmed' THEN
    SELECT profile_completed_at INTO v_profile_done
      FROM public.case_submissions WHERE case_id = NEW.id;
    IF v_profile_done IS NULL THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: the student file must be complete first';
    END IF;
    SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_service_total
      FROM public.case_services WHERE case_id = NEW.id;
    IF v_service_total <= 0 THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: select at least one DARB service before confirming payment';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'payment_confirmed' AND NEW.status = 'submitted' THEN
    SELECT payment_confirmed INTO v_paid FROM public.case_submissions WHERE case_id = NEW.id;
    IF COALESCE(v_paid, false) = false THEN
      RAISE EXCEPTION 'STAGE_BLOCKED: confirm the payment first';
    END IF;
    RETURN NEW;
  END IF;

  -- Admin sent the file back for corrections: reopen the profile step so the
  -- assigned team member can fix it and resubmit.
  IF OLD.status = 'submitted' AND NEW.status = 'profile_completion' THEN
    SELECT review_status INTO v_review FROM public.case_submissions WHERE case_id = NEW.id;
    IF v_review = 'changes_requested' OR public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'STAGE_BLOCKED: only an administrator can reopen a submitted file';
  END IF;

  IF OLD.status = 'submitted' AND NEW.status = 'enrollment_paid' THEN
    IF public.has_role(auth.uid(), 'admin') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'STAGE_BLOCKED: only an administrator can complete enrollment';
  END IF;

  RAISE EXCEPTION 'STAGE_BLOCKED: % -> % is not an allowed transition', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_case_stage_transition ON public.cases;
CREATE TRIGGER trg_enforce_case_stage_transition
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_stage_transition();
