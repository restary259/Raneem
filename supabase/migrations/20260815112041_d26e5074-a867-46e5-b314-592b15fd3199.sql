CREATE OR REPLACE FUNCTION public.guard_submission_required_for_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'enrollment_paid' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.case_submissions cs
      WHERE cs.case_id = NEW.id AND cs.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION
        'SUBMIT_BLOCKED: cannot advance case % to enrollment_paid — the student submission record is missing',
        NEW.id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;