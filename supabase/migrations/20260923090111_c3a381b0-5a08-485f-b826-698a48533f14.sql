CREATE OR REPLACE FUNCTION public.get_my_case_submission()
RETURNS TABLE(case_id uuid, student_email text, student_phone text, extra_data jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.case_id, s.student_email, s.student_phone, s.extra_data
  FROM public.case_submissions s
  JOIN public.cases c ON c.id = s.case_id
  WHERE c.student_user_id = auth.uid()
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_my_case_submission() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_case_submission() TO authenticated;