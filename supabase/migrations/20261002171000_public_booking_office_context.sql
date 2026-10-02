-- Office-specific public booking entry.
--
-- `/book-appointment?office=<slug>` (used by Google Business and campaign
-- links) resolves the slug server-side and passes the office id here, so the
-- case is attributed to the office at creation time — even if the applicant
-- never books an appointment. Omitting the office keeps the previous generic
-- behaviour (office chosen later in the booking flow).
--
-- The old 2-argument signature is dropped explicitly rather than left as a
-- stale overload; the repo has previously been bitten by lingering overloads.

DROP FUNCTION IF EXISTS public.create_public_booking_session(text, text);

CREATE OR REPLACE FUNCTION public.create_public_booking_session(
  p_full_name text,
  p_phone text,
  p_office_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text := btrim(COALESCE(p_full_name, ''));
  v_phone text := regexp_replace(btrim(COALESCE(p_phone, '')), '[^0-9+]', '', 'g');
  v_office_id uuid := p_office_id;
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

  -- A provided office is only honoured when it is live and bookable; an
  -- unknown/unavailable id degrades to a generic booking rather than failing.
  IF v_office_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.offices o
    WHERE o.id = v_office_id
      AND o.is_active = true
      AND o.booking_enabled = true
      AND o.deleted_at IS NULL
  ) THEN
    v_office_id := NULL;
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
    source,
    office_id
  )
  VALUES (
    v_name,
    v_phone,
    'new',
    'public_booking',
    v_office_id
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
    'office_id', v_office_id,
    'expires_at', now() + interval '14 days'
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_public_booking_session(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_session(text, text, uuid)
  TO service_role;
