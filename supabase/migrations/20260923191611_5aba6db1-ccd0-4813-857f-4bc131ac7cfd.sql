-- 1. Consent audit columns -------------------------------------------------
ALTER TABLE public.whatsapp_leads
  ADD COLUMN IF NOT EXISTS marketing_consent_updated_by uuid,
  ADD COLUMN IF NOT EXISTS marketing_consent_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.whatsapp_set_marketing_consent(p_lead_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'team_member'::app_role)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_status NOT IN ('unknown', 'granted', 'declined', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid consent status';
  END IF;

  UPDATE public.whatsapp_leads
  SET marketing_consent_status = p_status,
      marketing_consent_updated_by = auth.uid(),
      marketing_consent_updated_at = now(),
      updated_at = now()
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_set_marketing_consent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_marketing_consent(uuid, text) TO authenticated;

-- 2. Conversation ownership: allow self-claim / self-release ----------------
CREATE OR REPLACE FUNCTION public.whatsapp_set_conversation_assignment(p_conversation_id uuid, p_assigned_to uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_current uuid;
BEGIN
  SELECT assigned_to INTO v_current
  FROM public.whatsapp_conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  IF NOT v_is_admin THEN
    -- Team members with inbox access may claim an unowned conversation for
    -- themselves, or release one they already own. Nothing else.
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.deleted_at IS NULL
        AND COALESCE(p.whatsapp_inbox_enabled, false)
    ) OR NOT public.has_role(auth.uid(), 'team_member'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can assign conversations';
    END IF;

    IF p_assigned_to IS NOT NULL AND p_assigned_to <> auth.uid() THEN
      RAISE EXCEPTION 'You can only claim a conversation for yourself';
    END IF;

    IF p_assigned_to IS NULL AND v_current IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only release a conversation you own';
    END IF;

    IF p_assigned_to IS NOT NULL AND v_current IS NOT NULL AND v_current <> auth.uid() THEN
      RAISE EXCEPTION 'This conversation already has an owner';
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
$$;

-- 3. Delivery health --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_whatsapp_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
  v_since timestamptz := date_trunc('day', now());
  v_result jsonb;
BEGIN
  IF NOT (v_is_admin OR public.has_role(auth.uid(), 'team_member'::app_role)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT jsonb_build_object(
    'inbound', COALESCE(SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END), 0),
    'outbound', COALESCE(SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END), 0),
    'delivered', COALESCE(SUM(CASE WHEN direction = 'outbound' AND delivery_status IN ('delivered', 'read') THEN 1 ELSE 0 END), 0),
    'failed', COALESCE(SUM(CASE WHEN direction = 'outbound' AND delivery_status = 'failed' THEN 1 ELSE 0 END), 0)
  )
  INTO v_result
  FROM public.whatsapp_messages
  WHERE created_at >= v_since;

  v_result := v_result
    || jsonb_build_object(
      'queued', (
        SELECT COUNT(*) FROM public.whatsapp_follow_up_tasks
        WHERE status IN ('pending', 'scheduled', 'queued')
      ) + (
        SELECT COUNT(*) FROM public.whatsapp_campaign_recipients
        WHERE status IN ('pending', 'scheduled', 'queued')
      ),
      'blocked_incoming', CASE WHEN v_is_admin THEN (
        SELECT COUNT(*) FROM public.whatsapp_ingest_failures WHERE resolved_at IS NULL
      ) ELSE 0 END,
      'failed_jobs', (
        SELECT COUNT(*) FROM public.whatsapp_follow_up_tasks f
        WHERE f.status = 'failed'
          AND (v_is_admin OR EXISTS (
            SELECT 1 FROM public.whatsapp_conversations c
            WHERE c.id = f.conversation_id AND c.assigned_to = auth.uid()
          ))
      ) + (
        SELECT COUNT(*) FROM public.whatsapp_campaign_recipients r
        WHERE r.status = 'failed'
          AND (v_is_admin OR EXISTS (
            SELECT 1 FROM public.whatsapp_conversations c
            WHERE c.id = r.conversation_id AND c.assigned_to = auth.uid()
          ))
      ),
      'is_admin', v_is_admin
    );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_health() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_whatsapp_ingest_failures(p_include_resolved boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  delivery_id text,
  event_type text,
  error_code text,
  error_message text,
  phone_number text,
  created_at timestamptz,
  resolved_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.delivery_id,
         f.event_type,
         f.error_code,
         f.error_message,
         NULLIF(COALESCE(f.payload->>'from_number', f.payload->>'wa_id', f.payload->>'phone_number'), ''),
         f.created_at,
         f.resolved_at
  FROM public.whatsapp_ingest_failures f
  WHERE p_include_resolved OR f.resolved_at IS NULL
  ORDER BY f.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_ingest_failures(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_ingest_failures(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_resolve_ingest_failure(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.whatsapp_ingest_failures
  SET resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_id AND resolved_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_resolve_ingest_failure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_resolve_ingest_failure(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_whatsapp_failed_jobs()
RETURNS TABLE (
  kind text,
  id uuid,
  conversation_id uuid,
  contact_name text,
  phone_number text,
  last_error text,
  attempt_count integer,
  failed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF NOT (v_is_admin OR public.has_role(auth.uid(), 'team_member'::app_role)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  RETURN QUERY
  SELECT 'follow_up'::text,
         f.id,
         f.conversation_id,
         l.student_name,
         l.whatsapp_number,
         f.last_error,
         f.attempt_count,
         COALESCE(f.processed_at, f.updated_at)
  FROM public.whatsapp_follow_up_tasks f
  JOIN public.whatsapp_conversations c ON c.id = f.conversation_id
  JOIN public.whatsapp_leads l ON l.id = c.lead_id
  WHERE f.status = 'failed'
    AND (v_is_admin OR c.assigned_to = auth.uid())

  UNION ALL

  SELECT 'campaign'::text,
         r.id,
         r.conversation_id,
         l.student_name,
         l.whatsapp_number,
         r.last_error,
         r.attempt_count,
         COALESCE(r.processed_at, r.updated_at)
  FROM public.whatsapp_campaign_recipients r
  JOIN public.whatsapp_conversations c ON c.id = r.conversation_id
  JOIN public.whatsapp_leads l ON l.id = c.lead_id
  WHERE r.status = 'failed'
    AND (v_is_admin OR c.assigned_to = auth.uid())

  ORDER BY 8 DESC NULLS LAST
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_failed_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_failed_jobs() TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_retry_failed_job(p_kind text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF p_kind = 'follow_up' THEN
    UPDATE public.whatsapp_follow_up_tasks
    SET status = 'pending', attempt_count = 0, last_error = NULL, processed_at = NULL, updated_at = now()
    WHERE id = p_id AND status = 'failed';
  ELSIF p_kind = 'campaign' THEN
    UPDATE public.whatsapp_campaign_recipients
    SET status = 'pending', attempt_count = 0, last_error = NULL, processed_at = NULL, updated_at = now()
    WHERE id = p_id AND status = 'failed';
  ELSE
    RAISE EXCEPTION 'Unknown job kind';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_retry_failed_job(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_retry_failed_job(text, uuid) TO authenticated;