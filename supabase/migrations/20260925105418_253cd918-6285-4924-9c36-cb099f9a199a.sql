CREATE OR REPLACE FUNCTION public.whatsapp_update_lead_fields(p_whatsapp_lead_id uuid, p_patch jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned uuid;
  v_conversation_id uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_team boolean := public.has_role(auth.uid(), 'team_member'::app_role);
BEGIN
  IF NOT (v_is_admin OR v_is_team) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RAISE EXCEPTION 'Invalid patch'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN (
      'student_name','country','target_country','desired_program','language_level','budget_range',
      'intended_start_date','tags','consent_status','source','lead_stage')) THEN
    RAISE EXCEPTION 'Unsupported WhatsApp lead field';
  END IF;
  IF p_patch ? 'lead_stage' AND NOT (p_patch->>'lead_stage') IN
     ('new','contacted','appointment_scheduled','profile_completion','payment_confirmed','submitted','enrollment_paid','forgotten','cancelled') THEN
    RAISE EXCEPTION 'Invalid lead stage';
  END IF;

  SELECT c.id, c.assigned_to INTO v_conversation_id, v_assigned
  FROM public.whatsapp_conversations c WHERE c.lead_id = p_whatsapp_lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WhatsApp conversation not found'; END IF;
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
      tags = CASE WHEN p_patch ? 'tags' AND jsonb_typeof(p_patch->'tags') = 'array'
          THEN ARRAY(SELECT left(value,40) FROM jsonb_array_elements_text(p_patch->'tags') WHERE btrim(value) <> '' LIMIT 20)
        ELSE tags END,
      consent_status = CASE WHEN p_patch ? 'consent_status' THEN left(p_patch->>'consent_status',40) ELSE consent_status END,
      source = CASE WHEN p_patch ? 'source' THEN left(p_patch->>'source',120) ELSE source END,
      lead_stage = CASE WHEN p_patch ? 'lead_stage' THEN p_patch->>'lead_stage' ELSE lead_stage END,
      updated_at = now()
  WHERE id = p_whatsapp_lead_id;
END;
$function$;