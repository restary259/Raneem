-- Attach the guard_submission_required_for_submit() trigger function
-- (defined in 20260815112041_...) to public.cases. The function was created
-- without a matching CREATE TRIGGER, so the guard never fired.
-- Fires BEFORE UPDATE OF status so a case cannot advance to 'enrollment_paid'
-- while no non-deleted case_submissions row exists for it.
DROP TRIGGER IF EXISTS trg_guard_submission_required_for_submit ON public.cases;
CREATE TRIGGER trg_guard_submission_required_for_submit
  BEFORE UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_required_for_submit();
