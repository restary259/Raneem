DROP VIEW IF EXISTS public.my_case;

CREATE OR REPLACE FUNCTION public.get_my_case()
RETURNS TABLE (
  id uuid, full_name text, phone_number text, status text, assigned_to uuid,
  source text, partner_id uuid, referred_by uuid, is_no_show boolean,
  student_user_id uuid, last_activity_at timestamptz, created_at timestamptz,
  updated_at timestamptz, city text, education_level text, bagrut_score numeric,
  english_level text, math_units integer, passport_type text, degree_interest text,
  intake_notes text, english_units integer, created_by_team boolean, origin text,
  case_reference text, archived boolean, archived_at timestamptz, partner_link_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.full_name, c.phone_number, c.status, c.assigned_to, c.source,
    c.partner_id, c.referred_by, c.is_no_show, c.student_user_id, c.last_activity_at,
    c.created_at, c.updated_at, c.city, c.education_level, c.bagrut_score,
    c.english_level, c.math_units, c.passport_type, c.degree_interest, c.intake_notes,
    c.english_units, c.created_by_team, c.origin, c.case_reference, c.archived,
    c.archived_at, c.partner_link_id
  FROM public.cases c
  WHERE c.student_user_id = auth.uid()
    AND c.deleted_at IS NULL
  ORDER BY c.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_my_case() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_case() TO authenticated;