-- ============================================================================
-- Fix: direct public booking rejected every phone number
--
-- `create_public_booking_session` is the RPC behind `/book-appointment`
-- (name + phone -> booking token). Its phone check read
--
--   IF v_phone !~ '^\\+?[0-9]{8,15}$' THEN RAISE EXCEPTION 'Invalid phone';
--
-- In a standard_conforming_strings session (the default, and what Supabase
-- applies migrations in) the literal '^\\+?[0-9]{8,15}$' contains TWO
-- backslashes, so the regex requires a literal backslash before the optional
-- digit run. No real phone number contains a backslash, so the function raised
-- 'Invalid phone' for every input — `+972...`, `972...` and `05...` alike —
-- and the direct booking entry point could never mint a token.
--
-- The sibling 2-argument version (20260927141533) used the correct
-- single-backslash form '^[+]?[0-9]{8,15}$'; the double backslash was
-- introduced by 20260927162000 and carried forward into 20261002171000.
--
-- This migration redefines the function with the corrected regex. Nothing else
-- changes: the office-context behaviour, the 30-minute rate limit, the token
-- minting and the grants are all preserved.
--
-- The `/apply` flow is unaffected: it mints its token through
-- `create_public_appointment_access`, which has no phone check.
--
-- Timestamp is newer than every function it redefines.
-- ============================================================================

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

  IF v_phone !~ '^\+?[0-9]{8,15}$' THEN
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
