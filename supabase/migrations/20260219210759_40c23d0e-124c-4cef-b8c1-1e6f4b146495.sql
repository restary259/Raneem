
-- Drop the unique INDEX on phone (it's an index, not a constraint)
-- Rollback: CREATE UNIQUE INDEX leads_phone_unique ON public.leads USING btree (phone);

DROP INDEX IF EXISTS public.leads_phone_unique;
