-- 1. Identity link columns (all optional, empty by default)
ALTER TABLE public.whatsapp_leads
  ADD COLUMN IF NOT EXISTS linked_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_confirmed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS identity_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_status text NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_leads'::regclass
      AND conname = 'whatsapp_leads_marketing_consent_status_check'
  ) THEN
    ALTER TABLE public.whatsapp_leads
      ADD CONSTRAINT whatsapp_leads_marketing_consent_status_check
      CHECK (marketing_consent_status = ANY (ARRAY['unknown','granted','declined','withdrawn']));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_leads_linked_case ON public.whatsapp_leads(linked_case_id);

-- 2. Staff guard helper
CREATE OR REPLACE FUNCTION public.is_whatsapp_staff(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT has_role(p_user, 'admin'::app_role) OR has_role(p_user, 'team_member'::app_role)
$$;

-- 3. Phone-match suggestions (read-only, never persists a link)
CREATE OR REPLACE FUNCTION public.whatsapp_identity_suggestions(p_whatsapp_lead_id uuid)
RETURNS TABLE (
  match_kind text,
  match_id uuid,
  display_name text,
  detail text,
  case_id uuid,
  profile_id uuid,
  lead_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tail text;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT right(regexp_replace(w.whatsapp_number, '\D', '', 'g'), 9)
    INTO v_tail
  FROM public.whatsapp_leads w
  WHERE w.id = p_whatsapp_lead_id;

  IF v_tail IS NULL OR length(v_tail) < 9 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 'case'::text,
         c.id,
         c.full_name,
         COALESCE(c.reference_code, c.status),
         c.id,
         NULL::uuid,
         NULL::uuid
  FROM public.cases c
  WHERE right(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9) = v_tail
    AND COALESCE(c.archived, false) = false
  ORDER BY c.created_at DESC
  LIMIT 5;

  RETURN QUERY
  SELECT 'profile'::text,
         p.id,
         p.full_name,
         COALESCE(p.email, ''),
         NULL::uuid,
         p.id,
         NULL::uuid
  FROM public.profiles p
  WHERE right(regexp_replace(COALESCE(p.phone_number, ''), '\D', '', 'g'), 9) = v_tail
    AND p.deleted_at IS NULL
  LIMIT 5;

  RETURN QUERY
  SELECT 'lead'::text,
         l.id,
         l.full_name,
         COALESCE(l.status, ''),
         NULL::uuid,
         NULL::uuid,
         l.id
  FROM public.leads l
  WHERE right(regexp_replace(COALESCE(l.phone, ''), '\D', '', 'g'), 9) = v_tail
  ORDER BY l.created_at DESC
  LIMIT 5;
END;
$$;

-- 4. Confirm a link (staff only). Never creates a lead or a case.
CREATE OR REPLACE FUNCTION public.whatsapp_link_identity(
  p_whatsapp_lead_id uuid,
  p_lead_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number text;
  v_prev_case uuid;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT whatsapp_number, linked_case_id INTO v_number, v_prev_case
  FROM public.whatsapp_leads WHERE id = p_whatsapp_lead_id;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'WhatsApp contact not found';
  END IF;

  UPDATE public.whatsapp_leads
     SET linked_lead_id = COALESCE(p_lead_id, linked_lead_id),
         linked_case_id = COALESCE(p_case_id, linked_case_id),
         linked_profile_id = COALESCE(p_profile_id, linked_profile_id),
         identity_confirmed_by = auth.uid(),
         identity_confirmed_at = now(),
         updated_at = now()
   WHERE id = p_whatsapp_lead_id;

  IF p_case_id IS NOT NULL AND p_case_id IS DISTINCT FROM v_prev_case THEN
    PERFORM public.log_case_event(
      p_case_id,
      'whatsapp_conversation_linked',
      jsonb_build_object('whatsapp_number', v_number),
      true
    );
  END IF;
END;
$$;

-- 5. Remove a link (staff only)
CREATE OR REPLACE FUNCTION public.whatsapp_unlink_identity(p_whatsapp_lead_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.whatsapp_leads
     SET linked_lead_id = NULL,
         linked_case_id = NULL,
         linked_profile_id = NULL,
         identity_confirmed_by = NULL,
         identity_confirmed_at = NULL,
         updated_at = now()
   WHERE id = p_whatsapp_lead_id;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_identity_suggestions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_link_identity(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_unlink_identity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_identity_suggestions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_link_identity(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_unlink_identity(uuid) TO authenticated;

-- 6. One staff alert per inbound message, through the existing notification system
CREATE OR REPLACE FUNCTION public.notify_whatsapp_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_assigned uuid;
  v_name text;
  v_recipient uuid;
BEGIN
  IF NEW.direction <> 'inbound' THEN
    RETURN NEW;
  END IF;

  SELECT c.assigned_to, COALESCE(NULLIF(l.student_name, ''), l.whatsapp_number)
    INTO v_assigned, v_name
  FROM public.whatsapp_conversations c
  JOIN public.whatsapp_leads l ON l.id = c.lead_id
  WHERE c.id = NEW.conversation_id;

  IF v_assigned IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_assigned, NULL, 'whatsapp_inbound',
      'New WhatsApp message', 'رسالة واتساب جديدة',
      COALESCE(v_name, '') , COALESCE(v_name, ''),
      NULL, '/admin/messages?tab=whatsapp',
      'whatsapp_inbound:' || NEW.id::text
    );
  ELSE
    FOR v_recipient IN
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role
    LOOP
      PERFORM public.emit_notification(
        v_recipient, NULL, 'whatsapp_inbound',
        'New WhatsApp message', 'رسالة واتساب جديدة',
        COALESCE(v_name, ''), COALESCE(v_name, ''),
        NULL, '/admin/messages?tab=whatsapp',
        'whatsapp_inbound:' || NEW.id::text || ':' || v_recipient::text
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_whatsapp_inbound ON public.whatsapp_messages;
CREATE TRIGGER trg_notify_whatsapp_inbound
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp_inbound();