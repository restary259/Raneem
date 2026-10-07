-- Correct only Jilan Bashuti's known HORIZONTE schedule. This migration is
-- intentionally guarded by both case UUID and reference and changes no money,
-- assignment, stage, or other student data.
UPDATE public.case_submissions AS cs
SET program_start_date = DATE '2026-10-26',
    program_end_date = DATE '2027-06-18',
    updated_at = now()
FROM public.cases AS c
WHERE c.id = cs.case_id
  AND c.id = '05c79846-fc21-4283-8e06-e2157d9c37dc'::uuid
  AND c.case_reference = 'DRB-2026-000162'
  AND c.full_name = 'Jilan Bashuti'
  AND cs.program_weeks = 34
  AND cs.school_id = 'e1be5e36-1000-40db-8188-814089d8beaa'::uuid
  AND EXISTS (
    SELECT 1
    FROM public.partner_schools AS ps
    JOIN public.school_start_dates AS ssd ON ssd.school_id = ps.id
    WHERE ps.catalog_school_id = cs.school_id
      AND ssd.start_date = DATE '2026-10-26'
      AND ssd.audience = 'beginner'
  );
