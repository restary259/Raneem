CREATE OR REPLACE FUNCTION public.validate_case_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  IF NEW.student_email IS NOT NULL AND btrim(NEW.student_email) <> '' THEN
    IF NEW.student_email !~ '^[^@\s]+@[^@\s.]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'INVALID_FIELD:student_email';
    END IF;
  END IF;

  IF NEW.student_phone IS NOT NULL AND btrim(NEW.student_phone) <> '' THEN
    digits := regexp_replace(NEW.student_phone, '\D', '', 'g');
    IF length(digits) < 7 OR length(digits) > 15 THEN
      RAISE EXCEPTION 'INVALID_FIELD:student_phone';
    END IF;
  END IF;

  IF NEW.review_status = 'submitted' AND COALESCE(OLD.review_status, '') <> 'submitted' THEN
    IF NEW.school_id IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD:school_id'; END IF;
    IF NEW.program_id IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD:program_id'; END IF;
    IF NEW.program_start_date IS NULL THEN RAISE EXCEPTION 'INVALID_FIELD:start_month'; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_case_submission_trg ON public.case_submissions;
CREATE TRIGGER validate_case_submission_trg
  BEFORE INSERT OR UPDATE ON public.case_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_case_submission();