-- DARB Direct Public Appointment Entry
-- Creates a short-lived bearer booking session from a minimal public lead
-- (name + phone), then reuses the existing token-protected appointment engine.

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_source_check;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_source_check
  CHECK (
    source = ANY (ARRAY[
      'apply_page',
      'manual',
      'submit_new_student',
      'social_media_partner',
      'referral',
      'contact_form',
      'public_booking'
    ])
  );

CREATE OR REPLACE FUNCTION public.create_public_booking_session(
  p_full_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text := btrim(COALESCE(p_full_name, ''));
  v_phone text := regexp_replace(btrim(COALESCE(p_phone, '')), '[^0-9+]', '', 'g');
  v_case_id uuid;
  v_token text;
  v_token_hash text;
  v_recent_count integer;
BEGIN
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;

  IF v_phone !~ '^\\+?[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'Invalid phone';
  END IF;

  SELECT count(*)::integer
  INTO v_recent_count
  FROM public.cases c
  WHERE c.source = 'public_booking'
    AND c.phone_number = v_phone
    AND c.created_at > now() - interval '30 minutes'
    AND c.status NOT IN ('cancelled','forgotten');

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'Too many booking requests';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.cases (
    full_name,
    phone_number,
    status,
    source
  )
  VALUES (
    v_name,
    v_phone,
    'new',
    'public_booking'
  )
  RETURNING id INTO v_case_id;

  INSERT INTO public.public_appointment_access (
    case_id,
    token_hash,
    expires_at
  )
  VALUES (
    v_case_id,
    v_token_hash,
    now() + interval '14 days'
  );

  RETURN jsonb_build_object(
    'token', v_token,
    'expires_at', now() + interval '14 days'
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_public_booking_session(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_session(text,text)
  TO service_role;
