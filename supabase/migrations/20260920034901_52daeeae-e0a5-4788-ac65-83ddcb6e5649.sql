ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_key text,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz;

CREATE OR REPLACE FUNCTION public.whatsapp_crm_context(p_whatsapp_lead_id uuid)
RETURNS TABLE (
  lead_id uuid,
  lead_full_name text,
  lead_status text,
  lead_source_type text,
  case_id uuid,
  case_full_name text,
  case_status text,
  case_reference text,
  profile_id uuid,
  profile_full_name text,
  profile_student_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id, l.full_name::text, l.status::text, l.source_type::text,
    c.id, c.full_name::text, c.status::text, c.case_reference::text,
    p.id, p.full_name::text, p.student_status::text
  FROM public.whatsapp_leads wl
  LEFT JOIN public.leads l ON l.id = wl.linked_lead_id
  LEFT JOIN public.cases c ON c.id = wl.linked_case_id
  LEFT JOIN public.profiles p ON p.id = wl.linked_profile_id
  WHERE wl.id = p_whatsapp_lead_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_member'));
$$;

REVOKE ALL ON FUNCTION public.whatsapp_crm_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_crm_context(uuid) TO authenticated, service_role;