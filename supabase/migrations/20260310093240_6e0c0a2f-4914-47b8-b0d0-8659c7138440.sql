-- Migration 5: Drop the legacy student_cases table
-- All code has been migrated to the new `cases` table.
-- Cascades will drop all dependent RLS policies, triggers, and FKs automatically.

DROP TABLE IF EXISTS public.student_cases CASCADE;

-- Also drop legacy functions that reference student_cases
DROP FUNCTION IF EXISTS public.get_lawyer_lead_ids(uuid);
DROP FUNCTION IF EXISTS public.notify_case_status_change() CASCADE;
DROP FUNCTION IF EXISTS public.notify_influencer_case_created() CASCADE;
DROP FUNCTION IF EXISTS public.auto_split_payment() CASCADE;