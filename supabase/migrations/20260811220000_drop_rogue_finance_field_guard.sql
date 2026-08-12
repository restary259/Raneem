-- Drop the untracked BEFORE UPDATE trigger on case_submissions that blocks
-- finance fields (payment_confirmed, payment_confirmed_at, …) with the error
-- "Finance fields are controlled by the finance workflow".
--
-- This trigger was created directly on the production database (not via a
-- tracked migration) and aborts the confirm_agency_service_payment RPC — which
-- is SECURITY DEFINER — so the "Confirm & Save" button in the Finance tab
-- silently fails. The RPC needs to write case_submissions.payment_confirmed to
-- advance the case through the payment_confirmed -> submitted stage gate.
--
-- The only legitimate BEFORE UPDATE triggers on case_submissions are:
--   1. validate_case_submission_trg        (email/phone/school validation)
--   2. trg_submission_school_consistency   (school/program/accommodation check)
-- Both are recreated below so nothing functional is lost. Any other BEFORE
-- UPDATE trigger (the rogue guard) is dropped.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c   ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = 'case_submissions'
       AND NOT t.tgisinternal
       AND t.tgtype & 2 <> 0          -- BEFORE
       AND t.tgtype & 16 <> 0         -- UPDATE
       AND t.tgname NOT IN ('validate_case_submission_trg', 'trg_submission_school_consistency')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.case_submissions', r.tgname);
  END LOOP;
END $$;

-- Recreate the two legitimate BEFORE UPDATE triggers (idempotent).
DROP TRIGGER IF EXISTS validate_case_submission_trg ON public.case_submissions;
CREATE TRIGGER validate_case_submission_trg
  BEFORE INSERT OR UPDATE ON public.case_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_case_submission();

DROP TRIGGER IF EXISTS trg_submission_school_consistency ON public.case_submissions;
CREATE TRIGGER trg_submission_school_consistency
  BEFORE INSERT OR UPDATE OF school_id, program_id, accommodation_id ON public.case_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_school_consistency();
