-- Complete the WhatsApp -> DARB Lead bridge for genuinely unknown contacts.
-- Existing cases/profiles are never converted into leads by this path.
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
  SELECT whatsapp_number, NULLIF(student_name, '')
    INTO v_number, v_name
  FROM public.whatsapp_leads
  WHERE id = p_whatsapp_lead_id
  FOR UPDATE;

  IF v_number IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT linked_lead_id
    INTO v_existing_id
  FROM public.whatsapp_leads
  WHERE id = p_whatsapp_lead_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_linked', 'lead_id', v_existing_id);
  END IF;

  v_key := public.whatsapp_identity_phone_key(v_number);
  IF v_key = '' THEN
    RETURN jsonb_build_object('status', 'invalid_phone');
  END IF;

  -- Serialize creation for this canonical phone so concurrent webhook
  -- deliveries cannot create two core leads.
  PERFORM pg_advisory_xact_lock(hashtext('darb:whatsapp:lead:' || v_key));

  SELECT count(*), min(l.id)
    INTO v_count, v_existing_id
  FROM public.leads l
  WHERE l.deleted_at IS NULL
    AND public.whatsapp_identity_phone_key(l.phone) = v_key;

  IF v_count > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous', 'lead_count', v_count);
  END IF;

  IF v_count = 1 THEN
    UPDATE public.whatsapp_leads
       SET linked_lead_id = v_existing_id,
           identity_confirmed_by = NULL,
           identity_confirmed_at = now(),
           updated_at = now()
     WHERE id = p_whatsapp_lead_id;

    RETURN jsonb_build_object('status', 'auto_linked_existing_lead', 'lead_id', v_existing_id);
  END IF;

  INSERT INTO public.leads (
    full_name,
    phone,
    source_type,
    status,
    notes
  )
  VALUES (
    COALESCE(v_name, v_number),
    v_number,
    'whatsapp',
    'new',
    'Created from inbound WhatsApp contact.'
  )
  RETURNING id INTO v_new_id;

  UPDATE public.whatsapp_leads
     SET linked_lead_id = v_new_id,
         identity_confirmed_by = NULL,
         identity_confirmed_at = now(),
         updated_at = now()
   WHERE id = p_whatsapp_lead_id;

  RETURN jsonb_build_object('status', 'created_core_lead', 'lead_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_ensure_core_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_ensure_core_lead(uuid) TO service_role;

-- Keep the canonical ingest behavior and invoke the core-lead bridge only
-- when identity resolution found no existing DARB person.
