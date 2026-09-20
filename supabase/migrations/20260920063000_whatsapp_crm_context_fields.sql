-- Expand the least-privilege WhatsApp CRM context with operationally useful,
-- non-document student/case fields. STAGED ONLY.
DROP FUNCTION IF EXISTS public.whatsapp_crm_context(uuid);

CREATE FUNCTION public.whatsapp_crm_context(p_whatsapp_lead_id uuid)
RETURNS TABLE (
  lead_id uuid,
  lead_full_name text,
  lead_status text,
  lead_source_type text,
  lead_city text,
  lead_preferred_major text,
  lead_education_level text,
  case_id uuid,
  case_reference text,
  case_full_name text,
  case_status text,
  case_city text,
  case_degree_interest text,
  case_education_level text,
  case_assigned_to uuid,
  case_assigned_to_name text,
  profile_id uuid,
  profile_full_name text,
  profile_student_status text,
  profile_city text,
  profile_university_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $whatsapp_crm_context_extended$
DECLARE
  v_linked_lead_id uuid;
  v_linked_case_id uuid;
  v_linked_profile_id uuid;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT linked_lead_id, linked_case_id, linked_profile_id
  INTO v_linked_lead_id, v_linked_case_id, v_linked_profile_id
  FROM public.whatsapp_leads
  WHERE id = p_whatsapp_lead_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_linked_case_id IS NULL AND v_linked_profile_id IS NOT NULL THEN
    SELECT COALESCE(p.case_id, p.linked_case_id)
    INTO v_linked_case_id
    FROM public.profiles p
    WHERE p.id = v_linked_profile_id
      AND p.deleted_at IS NULL;
  END IF;

  IF v_linked_profile_id IS NULL AND v_linked_case_id IS NOT NULL THEN
    SELECT c.student_user_id
    INTO v_linked_profile_id
    FROM public.cases c
    WHERE c.id = v_linked_case_id
      AND c.deleted_at IS NULL;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.full_name,
    l.status,
    l.source_type,
    l.city,
    l.preferred_major,
    l.education_level,
    c.id,
    c.case_reference,
    c.full_name,
    c.status,
    c.city,
    c.degree_interest,
    c.education_level,
    c.assigned_to,
    assignee.full_name,
    p.id,
    p.full_name,
    p.student_status,
    p.city,
    p.university_name
  FROM (SELECT v_linked_lead_id AS id) x
  LEFT JOIN public.leads l
    ON l.id = x.id
   AND l.deleted_at IS NULL
  LEFT JOIN public.cases c
    ON c.id = v_linked_case_id
   AND c.deleted_at IS NULL
  LEFT JOIN public.profiles assignee
    ON assignee.id = c.assigned_to
   AND assignee.deleted_at IS NULL
  LEFT JOIN public.profiles p
    ON p.id = v_linked_profile_id
   AND p.deleted_at IS NULL;
END;
$whatsapp_crm_context_extended$;

REVOKE ALL ON FUNCTION public.whatsapp_crm_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_crm_context(uuid) TO authenticated;
