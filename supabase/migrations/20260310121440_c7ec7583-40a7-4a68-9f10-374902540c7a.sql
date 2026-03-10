-- Advance Ahmad E2E Test case to enrollment_paid (triggers auto_split_payment → record_case_commission)
UPDATE public.cases 
SET status = 'enrollment_paid'
WHERE id = '77ab3958-60e7-4598-bd1a-0bfd9992e7dc';