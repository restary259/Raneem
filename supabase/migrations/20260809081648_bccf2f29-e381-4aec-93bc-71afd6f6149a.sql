-- 1. Real school relationship on submissions
ALTER TABLE public.case_submissions
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_case_submissions_school_id ON public.case_submissions(school_id);

-- Backfill: explicit school in extra_data first, then the programme's school.
UPDATE public.case_submissions cs
SET school_id = s.id
FROM public.schools s
WHERE cs.school_id IS NULL
  AND (cs.extra_data->>'school_id') IS NOT NULL
  AND (cs.extra_data->>'school_id')::uuid = s.id;

UPDATE public.case_submissions cs
SET school_id = p.school_id
FROM public.programs p
WHERE cs.school_id IS NULL
  AND cs.program_id = p.id
  AND p.school_id IS NOT NULL;

UPDATE public.case_submissions cs
SET school_id = a.school_id
FROM public.accommodations a
WHERE cs.school_id IS NULL
  AND cs.accommodation_id = a.id
  AND a.school_id IS NOT NULL;

-- 2. Reject cross-school combinations server-side
CREATE OR REPLACE FUNCTION public.enforce_submission_school_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog_school uuid;
  accom_school uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.program_id IS NOT NULL THEN
    SELECT school_id INTO prog_school FROM public.programs WHERE id = NEW.program_id;
    IF prog_school IS NOT NULL AND prog_school <> NEW.school_id THEN
      RAISE EXCEPTION 'Programme does not belong to the selected school';
    END IF;
  END IF;

  IF NEW.accommodation_id IS NOT NULL THEN
    SELECT school_id INTO accom_school FROM public.accommodations WHERE id = NEW.accommodation_id;
    IF accom_school IS NOT NULL AND accom_school <> NEW.school_id THEN
      RAISE EXCEPTION 'Accommodation does not belong to the selected school';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submission_school_consistency ON public.case_submissions;
CREATE TRIGGER trg_submission_school_consistency
  BEFORE INSERT OR UPDATE OF school_id, program_id, accommodation_id ON public.case_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_school_consistency();

-- 3. Multiple emergency contacts on student profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.profiles
SET emergency_contacts = jsonb_build_array(
  jsonb_build_object(
    'name', emergency_contact_name,
    'relationship', '',
    'phone', COALESCE(emergency_contact_phone, '')
  )
)
WHERE emergency_contacts = '[]'::jsonb
  AND emergency_contact_name IS NOT NULL
  AND emergency_contact_name <> '';