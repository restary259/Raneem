-- WhatsApp staff visibility, controlled assignment, and marketing opt-out.
-- STAGED ONLY. Apply with the final Supabase migration pass.
-- Team members see unassigned work plus their own assigned conversations.
-- Admins retain full WhatsApp access.

DROP POLICY IF EXISTS "Staff manage WhatsApp conversations" ON public.whatsapp_conversations;
CREATE POLICY "Admin manage WhatsApp conversations"
ON public.whatsapp_conversations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read own or unassigned WhatsApp conversations"
ON public.whatsapp_conversations
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

CREATE POLICY "Team update own or unassigned WhatsApp conversations"
ON public.whatsapp_conversations
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

DROP POLICY IF EXISTS "Staff manage WhatsApp leads" ON public.whatsapp_leads;
CREATE POLICY "Admin manage WhatsApp leads"
ON public.whatsapp_leads
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

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

CREATE POLICY "Team update WhatsApp lead fields for visible conversations"
ON public.whatsapp_leads
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.lead_id = whatsapp_leads.id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Staff manage WhatsApp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Admin manage WhatsApp messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Team insert WhatsApp messages for visible conversations" ON public.whatsapp_messages;

CREATE POLICY "Admin read WhatsApp messages"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read WhatsApp messages for visible conversations"
ON public.whatsapp_messages
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_messages.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_messages FROM authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;

DROP POLICY IF EXISTS "Staff manage WhatsApp internal notes" ON public.whatsapp_internal_notes;
CREATE POLICY "Admin manage WhatsApp internal notes"
ON public.whatsapp_internal_notes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read WhatsApp internal notes for visible conversations"
ON public.whatsapp_internal_notes
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_internal_notes.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

CREATE POLICY "Team insert own WhatsApp internal notes"
ON public.whatsapp_internal_notes
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_internal_notes.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

DROP POLICY IF EXISTS "Staff read WhatsApp audit events" ON public.whatsapp_events;
CREATE POLICY "Admin read WhatsApp audit events"
ON public.whatsapp_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team read WhatsApp audit events for visible conversations"
ON public.whatsapp_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_conversations c
    WHERE c.id = whatsapp_events.conversation_id
      AND (c.assigned_to = auth.uid() OR c.assigned_to IS NULL)
  )
);

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
  v_current uuid;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_is_team boolean := public.has_role(auth.uid(), 'team_member'::app_role);
BEGIN
  IF NOT (v_is_admin OR v_is_team) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT assigned_to INTO v_current
  FROM public.whatsapp_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NOT v_is_admin THEN
    IF v_current IS NOT NULL AND v_current <> auth.uid() THEN
      RAISE EXCEPTION 'You can only manage conversations assigned to you';
    END IF;
    IF p_assigned_to IS NOT NULL AND p_assigned_to <> auth.uid() THEN
      RAISE EXCEPTION 'Team members can only assign a conversation to themselves';
    END IF;
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

CREATE OR REPLACE FUNCTION public.whatsapp_apply_marketing_opt_out(p_whatsapp_lead_id uuid, p_body text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_optout$
DECLARE
  v_match boolean := false;
BEGIN
  v_match := lower(trim(coalesce(p_body,''))) IN (
    'stop',
    'unsubscribe',
    'cancel',
    'إلغاء',
    'وقف',
    'الغاء',
    'הסר',
    'הסרה'
  );

  IF NOT v_match THEN
    RETURN false;
  END IF;

  UPDATE public.whatsapp_leads
  SET marketing_consent_status = 'withdrawn',
      updated_at = now()
  WHERE id = p_whatsapp_lead_id;

  RETURN FOUND;
END;
$whatsapp_optout$;

REVOKE ALL ON FUNCTION public.whatsapp_apply_marketing_opt_out(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_apply_marketing_opt_out(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_whatsapp_marketing_opt_out()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_optout_trigger$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT c.lead_id INTO v_lead_id
  FROM public.whatsapp_conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_lead_id IS NOT NULL AND public.whatsapp_apply_marketing_opt_out(v_lead_id, NEW.body) THEN
    INSERT INTO public.whatsapp_events(conversation_id, actor_id, event_type, details)
    VALUES (
      NEW.conversation_id,
      NULL,
      'marketing_opt_out',
      jsonb_build_object('message_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$whatsapp_optout_trigger$;

REVOKE ALL ON FUNCTION public.process_whatsapp_marketing_opt_out() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_marketing_opt_out() TO service_role;

DROP TRIGGER IF EXISTS process_whatsapp_marketing_opt_out ON public.whatsapp_messages;
CREATE TRIGGER process_whatsapp_marketing_opt_out
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.process_whatsapp_marketing_opt_out();


-- Templates are managed through the connector by admins. Team only needs
-- released approved templates for rendering/sending.
DO $$
BEGIN
  IF to_regclass('public.whatsapp_templates') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Staff manage WhatsApp templates" ON public.whatsapp_templates;
    DROP POLICY IF EXISTS "Admin manage WhatsApp templates" ON public.whatsapp_templates;
    DROP POLICY IF EXISTS "Team read released WhatsApp templates" ON public.whatsapp_templates;

    CREATE POLICY "Admin manage WhatsApp templates"
    ON public.whatsapp_templates
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

    CREATE POLICY "Team read released WhatsApp templates"
    ON public.whatsapp_templates
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'team_member'::app_role)
      AND approval_status = 'APPROVED'
      AND is_active = true
      AND available_to_team = true
    );

    REVOKE INSERT, UPDATE, DELETE ON public.whatsapp_templates FROM authenticated;
    GRANT SELECT ON public.whatsapp_templates TO authenticated;
  END IF;
END
$$;
