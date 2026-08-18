-- Allow restoring a cancelled case back to contacted.
-- The frontend already allows this transition (caseTransitions.ts), but the
-- server-side enforce_case_stage_transition() trigger was missing 'cancelled'
-- from the allowed OLD.status list for the -> contacted edge.

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
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions) and cancellation are always allowed.
  IF auth.role() = 'service_role' OR NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('new', 'forgotten', 'cancelled') AND NEW.status = 'contacted' THEN
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
