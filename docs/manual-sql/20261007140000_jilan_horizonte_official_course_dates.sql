-- Set the official HORIZONTE schedule for Jilan Bashuti only.
-- Verified official start: 2026-10-26. A 34-calendar-week booking ends
-- Friday 2027-06-18; school closures and public holidays do not extend it.
-- This changes no money, case stage, assignment, or other student data.

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
  AND EXISTS (
    SELECT 1
    FROM public.partner_schools AS ps
    JOIN public.school_start_dates AS ssd ON ssd.school_id = ps.id
    WHERE ps.catalog_school_id = cs.school_id
      AND lower(ps.name) LIKE '%horizonte%'
      AND ssd.start_date = DATE '2026-10-26'
      AND ssd.audience = 'beginner'
  );

-- Verification (must return exactly one row with the dates above):
SELECT c.case_reference,
       c.full_name,
       cs.program_weeks,
       cs.program_start_date,
       cs.program_end_date
FROM public.case_submissions AS cs
JOIN public.cases AS c ON c.id = cs.case_id
WHERE c.id = '05c79846-fc21-4283-8e06-e2157d9c37dc'::uuid
  AND c.case_reference = 'DRB-2026-000162';