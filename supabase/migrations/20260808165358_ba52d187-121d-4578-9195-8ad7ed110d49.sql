-- 1. Lock down student access to internal financial columns on cases.
DROP POLICY IF EXISTS "Students can view own case" ON public.cases;

CREATE OR REPLACE VIEW public.my_case
WITH (security_invoker = off) AS
SELECT
  id, full_name, phone_number, status, assigned_to, source, partner_id, referred_by,
  is_no_show, student_user_id, last_activity_at, created_at, updated_at, city,
  education_level, bagrut_score, english_level, math_units, passport_type,
  degree_interest, intake_notes, english_units, created_by_team, origin, deleted_at,
  source_attribution_method, case_reference, archived, archived_at, partner_link_id
FROM public.cases
WHERE student_user_id = auth.uid();

REVOKE ALL ON public.my_case FROM anon;
GRANT SELECT ON public.my_case TO authenticated;

-- 2. Pin search_path on functions flagged by the linter.
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, extensions;
ALTER FUNCTION public.validate_chat_attachments(jsonb) SET search_path = public;