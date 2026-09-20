CREATE OR REPLACE FUNCTION public.whatsapp_update_conversation(
  p_conversation_id uuid,
  p_patch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_update_conversation$
DECLARE
  v_current_owner uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_team boolean := public.has_role(auth.uid(), 'team_member'::app_role);
  v_state text;
  v_priority text;
BEGIN
  IF NOT (v_is_admin OR v_is_team) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Invalid patch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) k
    WHERE k NOT IN ('state','priority','intent','language_code','campaign_key')
  ) THEN
    RAISE EXCEPTION 'Unsupported conversation field';
  END IF;

  SELECT assigned_to INTO v_current_owner
  FROM public.whatsapp_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NOT v_is_admin AND v_current_owner IS NOT NULL AND v_current_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You can only update your assigned conversations';
  END IF;

  v_state := p_patch->>'state';
  IF v_state IS NOT NULL AND v_state NOT IN ('new','open','waiting','resolved','waiting_for_team','waiting_for_student','snoozed','closed') THEN
    RAISE EXCEPTION 'Invalid WhatsApp conversation state';
  END IF;

  v_priority := p_patch->>'priority';
  IF v_priority IS NOT NULL AND v_priority NOT IN ('normal','high','urgent') THEN
    RAISE EXCEPTION 'Invalid WhatsApp conversation priority';
  END IF;

  UPDATE public.whatsapp_conversations
  SET state = COALESCE(v_state, state),
      priority = COALESCE(v_priority, priority),
      intent = CASE WHEN p_patch ? 'intent' THEN NULLIF(p_patch->>'intent','') ELSE intent END,
      language_code = CASE WHEN p_patch ? 'language_code' THEN NULLIF(p_patch->>'language_code','') ELSE language_code END,
      campaign_key = CASE WHEN p_patch ? 'campaign_key' THEN NULLIF(left(p_patch->>'campaign_key',80),'') ELSE campaign_key END,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$whatsapp_update_conversation$;

REVOKE ALL ON FUNCTION public.whatsapp_update_conversation(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_update_conversation(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_mark_conversation_read(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_read$
DECLARE
  v_owner uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_team boolean := public.has_role(auth.uid(), 'team_member'::app_role);
BEGIN
  IF NOT (v_is_admin OR v_is_team) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT assigned_to INTO v_owner
  FROM public.whatsapp_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NOT v_is_admin AND v_owner IS NOT NULL AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'You can only mark your assigned conversations as read';
  END IF;

  UPDATE public.whatsapp_conversations
  SET unread_count = 0,
      updated_at = now()
  WHERE id = p_conversation_id;
END;
$whatsapp_read$;

REVOKE ALL ON FUNCTION public.whatsapp_mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_conversation_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_update_lead_fields(
  p_whatsapp_lead_id uuid,
  p_patch jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_lead_update$
DECLARE
  v_assigned uuid;
  v_conversation_id uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_team boolean := public.has_role(auth.uid(), 'team_member'::app_role);
BEGIN
  IF NOT (v_is_admin OR v_is_team) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Invalid patch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) k
    WHERE k NOT IN (
      'student_name','country','target_country','desired_program',
      'language_level','budget_range','intended_start_date','tags',
      'consent_status','source'
    )
  ) THEN
    RAISE EXCEPTION 'Unsupported WhatsApp lead field';
  END IF;

  SELECT c.id, c.assigned_to
    INTO v_conversation_id, v_assigned
  FROM public.whatsapp_conversations c
  WHERE c.lead_id = p_whatsapp_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WhatsApp conversation not found';
  END IF;

  IF NOT v_is_admin AND v_assigned IS NOT NULL AND v_assigned <> auth.uid() THEN
    RAISE EXCEPTION 'You can only edit your assigned WhatsApp lead';
  END IF;

  UPDATE public.whatsapp_leads
  SET student_name = CASE WHEN p_patch ? 'student_name' THEN left(p_patch->>'student_name',200) ELSE student_name END,
      country = CASE WHEN p_patch ? 'country' THEN NULLIF(left(p_patch->>'country',100),'') ELSE country END,
      target_country = CASE WHEN p_patch ? 'target_country' THEN NULLIF(left(p_patch->>'target_country',100),'') ELSE target_country END,
      desired_program = CASE WHEN p_patch ? 'desired_program' THEN NULLIF(left(p_patch->>'desired_program',160),'') ELSE desired_program END,
      language_level = CASE WHEN p_patch ? 'language_level' THEN NULLIF(left(p_patch->>'language_level',80),'') ELSE language_level END,
      budget_range = CASE WHEN p_patch ? 'budget_range' THEN NULLIF(left(p_patch->>'budget_range',80),'') ELSE budget_range END,
      intended_start_date = CASE WHEN p_patch ? 'intended_start_date' THEN NULLIF(left(p_patch->>'intended_start_date',40),'') ELSE intended_start_date END,
      tags = CASE
        WHEN p_patch ? 'tags' AND jsonb_typeof(p_patch->'tags') = 'array'
          THEN ARRAY(
            SELECT left(value,40)
            FROM jsonb_array_elements_text(p_patch->'tags')
            WHERE btrim(value) <> ''
            LIMIT 20
          )
        ELSE tags
      END,
      consent_status = CASE WHEN p_patch ? 'consent_status' THEN left(p_patch->>'consent_status',40) ELSE consent_status END,
      source = CASE WHEN p_patch ? 'source' THEN left(p_patch->>'source',120) ELSE source END,
      updated_at = now()
  WHERE id = p_whatsapp_lead_id;
END;
$whatsapp_lead_update$;

REVOKE ALL ON FUNCTION public.whatsapp_update_lead_fields(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_update_lead_fields(uuid,jsonb) TO authenticated;

DROP POLICY IF EXISTS "Admin manage WhatsApp conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Team update own or unassigned WhatsApp conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Admin read WhatsApp conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Team read own or unassigned WhatsApp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Admin read WhatsApp conversations"
ON public.whatsapp_conversations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read own or unassigned WhatsApp conversations"
ON public.whatsapp_conversations
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_conversations FROM authenticated;
GRANT SELECT ON public.whatsapp_conversations TO authenticated;

DROP POLICY IF EXISTS "Admin manage WhatsApp leads" ON public.whatsapp_leads;
DROP POLICY IF EXISTS "Team update WhatsApp lead fields for visible conversations" ON public.whatsapp_leads;
DROP POLICY IF EXISTS "Admin read WhatsApp leads" ON public.whatsapp_leads;
DROP POLICY IF EXISTS "Team read WhatsApp leads for visible conversations" ON public.whatsapp_leads;
CREATE POLICY "Admin read WhatsApp leads"
ON public.whatsapp_leads
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read WhatsApp leads for visible conversations"
ON public.whatsapp_leads
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_leads FROM authenticated;
GRANT SELECT ON public.whatsapp_leads TO authenticated;