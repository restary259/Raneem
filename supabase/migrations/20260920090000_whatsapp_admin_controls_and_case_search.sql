-- Team WhatsApp inbox simplification (2026-09-20).
-- 1) whatsapp_set_conversation_assignment is ADMIN-ONLY. Team members can no
--    longer claim or reassign conversations; the leader/administrator owns the
--    operational queue.
-- 2) whatsapp_update_conversation: non-admins may only patch `state`.
--    priority / intent / language_code / campaign_key are admin operational
--    controls and are rejected with a clear error for the team.
-- 3) whatsapp_search_cases(p_query) backs the team new-conversation dialog
--    (search a case, then open/connect its WhatsApp thread by phone without
--    creating a duplicate). Admin sees all active cases; team sees cases
--    assigned to them OR unassigned, matching the team conversation RLS
--    visibility. The phone_number column lets the dialog open the exact thread.

CREATE OR REPLACE FUNCTION public.whatsapp_set_conversation_assignment(
  p_conversation_id uuid,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_assign$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only administrators can assign conversations';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.whatsapp_conversations WHERE id = p_conversation_id
  ) THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF p_assigned_to IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = p_assigned_to
         AND p.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Assignee profile is not active';
  END IF;

  IF p_assigned_to IS NOT NULL
     AND NOT (
       public.has_role(p_assigned_to, 'admin'::app_role)
       OR public.has_role(p_assigned_to, 'team_member'::app_role)
     ) THEN
    RAISE EXCEPTION 'Assignee is not a DARB staff member';
  END IF;

  UPDATE public.whatsapp_conversations
  SET assigned_to = p_assigned_to,
      updated_at = now()
  WHERE id = p_conversation_id;

  RETURN p_assigned_to;
END;
$whatsapp_assign$;

REVOKE ALL ON FUNCTION public.whatsapp_set_conversation_assignment(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_conversation_assignment(uuid,uuid) TO authenticated;

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

  -- Team members may only change the operational state. Priority, intent,
  -- language and campaign key are admin operational controls.
  IF NOT v_is_admin AND EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_patch) k
    WHERE k <> 'state'
  ) THEN
    RAISE EXCEPTION 'Team members can only change the conversation state';
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

CREATE OR REPLACE FUNCTION public.whatsapp_search_cases(p_query text)
RETURNS TABLE(id uuid, case_reference text, full_name text, status text, phone_number text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.case_reference, c.full_name, c.status, c.phone_number
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_role(auth.uid(), 'team_member')
        AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
      )
    )
    AND (
      coalesce(p_query, '') = ''
      OR c.case_reference ILIKE '%' || p_query || '%'
      OR c.full_name ILIKE '%' || p_query || '%'
      OR regexp_replace(coalesce(c.phone_number, ''), '\D', '', 'g')
          LIKE '%' || regexp_replace(coalesce(p_query, ''), '\D', '', 'g') || '%'
    )
  ORDER BY c.last_activity_at DESC NULLS LAST
  LIMIT 8
$$;

REVOKE ALL ON FUNCTION public.whatsapp_search_cases(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_search_cases(text) TO authenticated;