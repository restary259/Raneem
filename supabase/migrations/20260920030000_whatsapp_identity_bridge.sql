-- WhatsApp -> DARB identity bridge.
-- WhatsApp is a channel into the existing CRM, never a second people database.

CREATE OR REPLACE FUNCTION public.whatsapp_identity_phone_key(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = public
AS $$
DECLARE
  v text := regexp_replace(trim(p_phone), '[^0-9+]', '', 'g');
BEGIN
  IF v = '' THEN RETURN ''; END IF;
  IF left(v, 2) = '00' THEN
    v := substr(v, 3);
  ELSIF left(v, 1) = '+' THEN
    v := substr(v, 2);
  END IF;
  -- Israeli mobile numbers are frequently stored locally as 05XXXXXXXX
  -- while WhatsApp supplies +9725XXXXXXXX.
  IF left(v, 1) = '0' AND length(v) = 10 AND left(v, 2) = '05' THEN
    v := '972' || substr(v, 2);
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_identity_phone_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_identity_phone_key(text) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_auto_resolve_identity(p_whatsapp_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_key text;
  v_case_id uuid;
  v_profile_id uuid;
  v_lead_id uuid;
  v_case_count integer := 0;
  v_profile_count integer := 0;
  v_unattached_profile_count integer := 0;
  v_lead_count integer := 0;
BEGIN
  SELECT whatsapp_number INTO v_number
  FROM public.whatsapp_leads WHERE id = p_whatsapp_lead_id FOR UPDATE;

  IF v_number IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  IF EXISTS (
    SELECT 1 FROM public.whatsapp_leads
    WHERE id = p_whatsapp_lead_id
      AND (linked_case_id IS NOT NULL OR linked_lead_id IS NOT NULL OR linked_profile_id IS NOT NULL)
  ) THEN
    RETURN jsonb_build_object('status','already_linked');
  END IF;

  v_key := public.whatsapp_identity_phone_key(v_number);
  IF v_key = '' THEN RETURN jsonb_build_object('status','invalid_phone'); END IF;

  SELECT count(*), min(c.id) INTO v_case_count, v_case_id
  FROM public.cases c
  WHERE c.deleted_at IS NULL
    AND COALESCE(c.archived,false) = false
    AND public.whatsapp_identity_phone_key(c.phone_number) = v_key;

  SELECT count(*), min(p.id) INTO v_profile_count, v_profile_id
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(COALESCE(p.phone_number,'')) = v_key;

  IF v_case_count = 1 THEN
    SELECT count(*) INTO v_unattached_profile_count
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND public.whatsapp_identity_phone_key(COALESCE(p.phone_number,'')) = v_key
      AND COALESCE(p.case_id,p.linked_case_id) IS DISTINCT FROM v_case_id
      AND NOT EXISTS (
        SELECT 1 FROM public.cases c2
        WHERE c2.id = v_case_id AND c2.student_user_id = p.id
      );
  ELSE
    v_unattached_profile_count := v_profile_count;
  END IF;

  SELECT count(*), min(l.id) INTO v_lead_count, v_lead_id
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(l.phone) = v_key;

  IF v_case_count > 1
     OR v_unattached_profile_count > 0
     OR v_lead_count > 1
     OR (v_profile_count > 1 AND v_case_count = 0) THEN
    RETURN jsonb_build_object(
      'status','ambiguous',
      'case_count',v_case_count,
      'profile_count',v_profile_count,
      'lead_count',v_lead_count
    );
  END IF;

  IF v_case_count = 1 THEN
    UPDATE public.whatsapp_leads
    SET linked_case_id = v_case_id,
        linked_profile_id = CASE WHEN v_profile_count = 1 THEN v_profile_id ELSE NULL END,
        linked_lead_id = CASE WHEN v_lead_count = 1 THEN v_lead_id ELSE NULL END,
        identity_confirmed_by = NULL,
        identity_confirmed_at = NULL,
        updated_at = now()
    WHERE id = p_whatsapp_lead_id;

    PERFORM public.log_case_event(
      v_case_id,
      'whatsapp_conversation_auto_linked',
      jsonb_build_object('whatsapp_number',v_number,'resolution','exact_phone'),
      true
    );

    RETURN jsonb_build_object(
      'status','auto_linked',
      'case_id',v_case_id,
      'profile_id',CASE WHEN v_profile_count = 1 THEN v_profile_id ELSE NULL END,
      'lead_id',CASE WHEN v_lead_count = 1 THEN v_lead_id ELSE NULL END
    );
  END IF;

  IF v_profile_count = 1 OR v_lead_count = 1 THEN
    UPDATE public.whatsapp_leads
    SET linked_profile_id = CASE WHEN v_profile_count = 1 THEN v_profile_id ELSE NULL END,
        linked_lead_id = CASE WHEN v_lead_count = 1 THEN v_lead_id ELSE NULL END,
        identity_confirmed_by = NULL,
        identity_confirmed_at = NULL,
        updated_at = now()
    WHERE id = p_whatsapp_lead_id;

    RETURN jsonb_build_object(
      'status','auto_linked',
      'profile_id',CASE WHEN v_profile_count = 1 THEN v_profile_id ELSE NULL END,
      'lead_id',CASE WHEN v_lead_count = 1 THEN v_lead_id ELSE NULL END
    );
  END IF;

  RETURN jsonb_build_object('status','unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_auto_resolve_identity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_auto_resolve_identity(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_ensure_core_lead(p_whatsapp_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
  v_key text;
  v_name text;
  v_existing_id uuid;
  v_count integer;
  v_new_id uuid;
BEGIN
  SELECT whatsapp_number, NULLIF(student_name,'')
  INTO v_number, v_name
  FROM public.whatsapp_leads WHERE id = p_whatsapp_lead_id FOR UPDATE;

  IF v_number IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  SELECT linked_lead_id INTO v_existing_id
  FROM public.whatsapp_leads WHERE id = p_whatsapp_lead_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','already_linked','lead_id',v_existing_id);
  END IF;

  v_key := public.whatsapp_identity_phone_key(v_number);
  IF v_key = '' THEN RETURN jsonb_build_object('status','invalid_phone'); END IF;

  PERFORM pg_advisory_xact_lock(hashtext('darb:whatsapp:lead:' || v_key));

  SELECT count(*), min(l.id) INTO v_count, v_existing_id
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(l.phone) = v_key;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('status','ambiguous','lead_count',v_count);
  END IF;

  IF v_count = 1 THEN
    UPDATE public.whatsapp_leads
    SET linked_lead_id = v_existing_id,
        identity_confirmed_by = NULL,
        identity_confirmed_at = NULL,
        updated_at = now()
    WHERE id = p_whatsapp_lead_id;
    RETURN jsonb_build_object('status','auto_linked_existing_lead','lead_id',v_existing_id);
  END IF;

  INSERT INTO public.leads (full_name,phone,source_type,status,notes)
  VALUES (COALESCE(v_name,v_number),v_number,'whatsapp','new','Created from inbound WhatsApp contact.')
  RETURNING id INTO v_new_id;

  UPDATE public.whatsapp_leads
  SET linked_lead_id = v_new_id,
      identity_confirmed_by = NULL,
      identity_confirmed_at = NULL,
      updated_at = now()
  WHERE id = p_whatsapp_lead_id;

  RETURN jsonb_build_object('status','created_core_lead','lead_id',v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ensure_core_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ensure_core_lead(uuid) TO service_role;

-- Staff-only, least-privilege CRM bridge. This avoids broad direct profiles reads
-- from the WhatsApp inbox while still exposing the exact linked records needed
-- to navigate the existing DARB workspace.
CREATE OR REPLACE FUNCTION public.whatsapp_crm_context(p_whatsapp_lead_id uuid)
RETURNS TABLE (
  lead_id uuid,
  lead_full_name text,
  lead_status text,
  lead_source_type text,
  case_id uuid,
  case_reference text,
  case_full_name text,
  case_status text,
  profile_id uuid,
  profile_full_name text,
  profile_student_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $
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

  -- Existing DARB relationships remain authoritative; never invent a case or
  -- profile from a WhatsApp-only record.
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
    c.id,
    c.case_reference,
    c.full_name,
    c.status,
    p.id,
    p.full_name,
    p.student_status
  FROM (SELECT v_linked_lead_id AS id) x
  LEFT JOIN public.leads l
    ON l.id = x.id
   AND l.deleted_at IS NULL
  LEFT JOIN public.cases c
    ON c.id = v_linked_case_id
   AND c.deleted_at IS NULL
  LEFT JOIN public.profiles p
    ON p.id = v_linked_profile_id
   AND p.deleted_at IS NULL;
END;
$;

REVOKE ALL ON FUNCTION public.whatsapp_crm_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_crm_context(uuid) TO authenticated;

-- Staff suggestions use canonical phone matching instead of last-9-digit matching.
CREATE OR REPLACE FUNCTION public.whatsapp_identity_suggestions(p_whatsapp_lead_id uuid)
RETURNS TABLE (match_kind text, match_id uuid, display_name text, detail text, case_id uuid, profile_id uuid, lead_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT public.whatsapp_identity_phone_key(w.whatsapp_number) INTO v_key
  FROM public.whatsapp_leads w WHERE w.id = p_whatsapp_lead_id;

  IF v_key IS NULL OR v_key = '' THEN RETURN; END IF;

  RETURN QUERY
  SELECT 'case'::text,c.id,c.full_name,COALESCE(c.case_reference,c.status),c.id,NULL::uuid,NULL::uuid
  FROM public.cases c
  WHERE c.deleted_at IS NULL AND COALESCE(c.archived,false)=false
    AND public.whatsapp_identity_phone_key(c.phone_number)=v_key
  ORDER BY c.created_at DESC LIMIT 10;

  RETURN QUERY
  SELECT 'profile'::text,p.id,p.full_name,COALESCE(p.email,''),NULL::uuid,p.id,NULL::uuid
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(COALESCE(p.phone_number,''))=v_key
  LIMIT 10;

  RETURN QUERY
  SELECT 'lead'::text,l.id,l.full_name,COALESCE(l.status,''),NULL::uuid,NULL::uuid,l.id
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(l.phone)=v_key
  ORDER BY l.created_at DESC LIMIT 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_link_identity(
  p_whatsapp_lead_id uuid,
  p_lead_id uuid DEFAULT NULL,
  p_case_id uuid DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_number text;
  v_key text;
  v_prev_case uuid;
  v_target_count integer;
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT whatsapp_number,linked_case_id INTO v_number,v_prev_case
  FROM public.whatsapp_leads WHERE id=p_whatsapp_lead_id FOR UPDATE;
  IF v_number IS NULL THEN RAISE EXCEPTION 'WhatsApp contact not found'; END IF;

  v_key := public.whatsapp_identity_phone_key(v_number);

  IF p_lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id=p_lead_id AND l.deleted_at IS NULL
      AND public.whatsapp_identity_phone_key(l.phone)=v_key
  ) THEN RAISE EXCEPTION 'Selected lead does not match the WhatsApp phone'; END IF;

  IF p_case_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cases c WHERE c.id=p_case_id AND c.deleted_at IS NULL
      AND public.whatsapp_identity_phone_key(c.phone_number)=v_key
  ) THEN RAISE EXCEPTION 'Selected case does not match the WhatsApp phone'; END IF;

  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=p_profile_id AND p.deleted_at IS NULL
      AND public.whatsapp_identity_phone_key(COALESCE(p.phone_number,''))=v_key
  ) THEN RAISE EXCEPTION 'Selected profile does not match the WhatsApp phone'; END IF;

  v_target_count :=
    (CASE WHEN p_lead_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_case_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_profile_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_target_count=0 THEN RAISE EXCEPTION 'At least one matching identity target is required'; END IF;

  UPDATE public.whatsapp_leads
  SET linked_lead_id=COALESCE(p_lead_id,linked_lead_id),
      linked_case_id=COALESCE(p_case_id,linked_case_id),
      linked_profile_id=COALESCE(p_profile_id,linked_profile_id),
      identity_confirmed_by=auth.uid(),
      identity_confirmed_at=now(),
      updated_at=now()
  WHERE id=p_whatsapp_lead_id;

  IF p_case_id IS NOT NULL AND p_case_id IS DISTINCT FROM v_prev_case THEN
    PERFORM public.log_case_event(
      p_case_id,
      'whatsapp_conversation_linked',
      jsonb_build_object('whatsapp_number',v_number,'resolution','staff_confirmed'),
      true
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_identity_suggestions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.whatsapp_link_identity(uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_identity_suggestions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_link_identity(uuid,uuid,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_ingest_event(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_id text := nullif(p_payload->>'delivery_id', '');
  v_events jsonb := coalesce(p_payload->'events', '[]'::jsonb);
  v_event jsonb;
  v_type text;
  v_inserted boolean := false;
  v_results jsonb := '[]'::jsonb;

  v_phone text;
  v_lead_id uuid;
  v_conversation_id uuid;
  v_provider_id text;
  v_body text;
  v_occurred timestamptz;
  v_status text;
  v_existing_rank integer;
  v_existing_at timestamptz;
  v_message_id uuid;
  v_pending record;
  v_resolution jsonb;
BEGIN
  IF v_delivery_id IS NULL THEN
    RAISE EXCEPTION 'delivery_id is required';
  END IF;

  -- Retry short-circuit: a delivery is applied exactly once.
  INSERT INTO public.whatsapp_deliveries (delivery_id, event_header, event_count)
  VALUES (v_delivery_id, nullif(p_payload->>'event', ''), jsonb_array_length(v_events))
  ON CONFLICT (delivery_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('status', 'duplicate', 'delivery_id', v_delivery_id);
  END IF;

  FOR v_event IN SELECT * FROM jsonb_array_elements(v_events)
  LOOP
    v_type := lower(coalesce(v_event->>'event_type', 'unhandled'));
    v_provider_id := nullif(v_event->>'provider_message_id', '');
    v_occurred := nullif(v_event->>'occurred_at', '')::timestamptz;

    ------------------------------------------------------------------
    IF v_type = 'whatsapp.message' THEN
      v_phone := regexp_replace(coalesce(v_event->>'from', ''), '\D', '', 'g');

      IF v_phone = '' OR v_provider_id IS NULL THEN
        INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
        VALUES (v_delivery_id, 'message.incomplete', v_event);
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'skipped');
        CONTINUE;
      END IF;

      -- Persist the WhatsApp message first, then resolve its phone into the existing DARB identity graph.
      INSERT INTO public.whatsapp_leads (whatsapp_number, student_name, source, consent_status, lead_stage)
      VALUES (v_phone, '', 'whatsapp', 'unknown', 'new')
      ON CONFLICT (whatsapp_number) DO NOTHING;

      SELECT id INTO v_lead_id FROM public.whatsapp_leads WHERE whatsapp_number = v_phone;

      INSERT INTO public.whatsapp_conversations (lead_id, state)
      VALUES (v_lead_id, 'new')
      ON CONFLICT (lead_id) DO NOTHING;

      SELECT id INTO v_conversation_id FROM public.whatsapp_conversations WHERE lead_id = v_lead_id;

      v_body := coalesce(v_event->>'text', '');

      INSERT INTO public.whatsapp_messages (
        conversation_id, provider_message_id, delivery_id, direction, message_type,
        body, media_provider_id, reply_to_provider_id, delivery_status,
        sent_at, status_updated_at, raw_payload
      )
      VALUES (
        v_conversation_id, v_provider_id, v_delivery_id, 'inbound',
        coalesce(nullif(v_event->>'message_type', ''), 'text'),
        v_body,
        nullif(v_event->>'media_provider_id', ''),
        nullif(v_event->>'reply_to_provider_id', ''),
        'delivered',
        coalesce(v_occurred, now()),
        coalesce(v_occurred, now()),
        coalesce(v_event->'raw', v_event)
      )
      ON CONFLICT (provider_message_id) DO NOTHING
      RETURNING id INTO v_message_id;

      IF v_message_id IS NOT NULL THEN
        UPDATE public.whatsapp_conversations
        SET last_inbound_at = coalesce(v_occurred, now()),
            unread_count = unread_count + 1,
            last_message_preview = left(nullif(v_body, ''), 240),
            state = CASE WHEN state = 'resolved' THEN 'open' ELSE state END,
            updated_at = now()
        WHERE id = v_conversation_id;

        v_resolution := public.whatsapp_auto_resolve_identity(v_lead_id);
        IF coalesce(v_resolution->>'status', '') = 'unknown' THEN
          v_resolution := public.whatsapp_ensure_core_lead(v_lead_id);
        END IF;
      END IF;

      -- Drain any status that arrived before this message.
      SELECT * INTO v_pending FROM public.whatsapp_pending_statuses WHERE provider_message_id = v_provider_id;
      IF FOUND THEN
        UPDATE public.whatsapp_messages
        SET delivery_status = v_pending.delivery_status,
            status_updated_at = v_pending.status_updated_at,
            error_status = coalesce(v_pending.error_status, error_status),
            error_message = coalesce(v_pending.error_message, error_message)
        WHERE provider_message_id = v_provider_id
          AND public.whatsapp_status_rank(v_pending.delivery_status) > public.whatsapp_status_rank(delivery_status);
        DELETE FROM public.whatsapp_pending_statuses WHERE provider_message_id = v_provider_id;
      END IF;

      v_results := v_results || jsonb_build_object('event_type', v_type, 'result',
        CASE WHEN v_message_id IS NULL THEN 'duplicate' ELSE 'stored' END);

    ------------------------------------------------------------------
    ELSIF v_type IN ('whatsapp.status', 'whatsapp.message_error') THEN
      v_status := lower(coalesce(nullif(v_event->>'status', ''),
                                 CASE WHEN v_type = 'whatsapp.message_error' THEN 'failed' ELSE '' END));

      IF v_provider_id IS NULL OR v_status = '' THEN
        INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
        VALUES (v_delivery_id, 'status.incomplete', v_event);
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'skipped');
        CONTINUE;
      END IF;

      SELECT public.whatsapp_status_rank(delivery_status), status_updated_at
        INTO v_existing_rank, v_existing_at
        FROM public.whatsapp_messages
       WHERE provider_message_id = v_provider_id;

      IF NOT FOUND THEN
        -- Park it; never create a message from a status.
        INSERT INTO public.whatsapp_pending_statuses (
          provider_message_id, delivery_status, status_updated_at, error_status, error_message, raw_payload
        )
        VALUES (
          v_provider_id, v_status, v_occurred,
          nullif(v_event->>'error_code', '')::integer,
          nullif(v_event->>'error_message', ''),
          coalesce(v_event->'raw', v_event)
        )
        ON CONFLICT (provider_message_id) DO UPDATE
          SET delivery_status = EXCLUDED.delivery_status,
              status_updated_at = EXCLUDED.status_updated_at,
              error_status = coalesce(EXCLUDED.error_status, public.whatsapp_pending_statuses.error_status),
              error_message = coalesce(EXCLUDED.error_message, public.whatsapp_pending_statuses.error_message),
              raw_payload = EXCLUDED.raw_payload,
              updated_at = now()
          WHERE public.whatsapp_status_rank(EXCLUDED.delivery_status)
              > public.whatsapp_status_rank(public.whatsapp_pending_statuses.delivery_status);

        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'pending');
        CONTINUE;
      END IF;

      IF public.whatsapp_status_rank(v_status) > v_existing_rank
         AND (v_occurred IS NULL OR v_existing_at IS NULL OR v_occurred >= v_existing_at) THEN
        UPDATE public.whatsapp_messages
        SET delivery_status = v_status,
            status_updated_at = coalesce(v_occurred, now()),
            error_status = coalesce(nullif(v_event->>'error_code', '')::integer, error_status),
            error_message = coalesce(nullif(v_event->>'error_message', ''), error_message)
        WHERE provider_message_id = v_provider_id;
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'applied');
      ELSE
        v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'ignored_out_of_order');
      END IF;

    ------------------------------------------------------------------
    ELSIF v_type = 'whatsapp.template_status' THEN
      UPDATE public.whatsapp_templates
      SET approval_status = upper(coalesce(nullif(v_event->>'template_status', ''), approval_status)),
          last_synced_at = now()
      WHERE provider_name = nullif(v_event->>'template_name', '')
        AND (nullif(v_event->>'template_language', '') IS NULL
             OR language_code = v_event->>'template_language');

      INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
      VALUES (v_delivery_id, v_type, v_event);

      v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'applied');

    ------------------------------------------------------------------
    ELSE
      INSERT INTO public.whatsapp_ingest_log (delivery_id, event_type, payload)
      VALUES (v_delivery_id, v_type, v_event);
      v_results := v_results || jsonb_build_object('event_type', v_type, 'result', 'logged');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('status', 'ok', 'delivery_id', v_delivery_id, 'events', v_results);
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ingest_event(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ingest_event(jsonb) TO service_role;