-- ============================================================
-- 1. Leads: remove blanket team_member read access
-- ============================================================
DROP POLICY IF EXISTS "Team can view all leads v2" ON public.leads;

-- ============================================================
-- 2. request_payout: derive amount server-side
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_payout(p_reward_ids uuid[], p_amount numeric, p_notes text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_requestor_role text DEFAULT 'influencer'::text, p_student_names text[] DEFAULT '{}'::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_not_owned_count integer;
  v_not_pending_count integer;
  v_locked_count integer;
  v_already_requested_count integer;
  v_amount numeric;
  v_count integer;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_reward_ids IS NULL OR array_length(p_reward_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No rewards selected';
  END IF;

  SELECT COUNT(*) INTO v_not_owned_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND user_id != auth.uid();
  IF v_not_owned_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards do not belong to you';
  END IF;

  SELECT COUNT(*) INTO v_not_pending_count
  FROM rewards WHERE id = ANY(p_reward_ids) AND status != 'pending';
  IF v_not_pending_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are not in pending status';
  END IF;

  SELECT COUNT(*) INTO v_locked_count
  FROM rewards
  WHERE id = ANY(p_reward_ids) AND (NOW() - created_at) < INTERVAL '20 days';
  IF v_locked_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are still within the 20-day lock period. Please wait before requesting payout.';
  END IF;

  SELECT COUNT(*) INTO v_already_requested_count
  FROM payout_requests
  WHERE status NOT IN ('rejected') AND linked_reward_ids && p_reward_ids;
  IF v_already_requested_count > 0 THEN
    RAISE EXCEPTION 'One or more rewards are already included in a pending payout request';
  END IF;

  -- The amount is NEVER taken from the client: it is the true sum of the
  -- caller's own selected rewards. p_amount is accepted for signature
  -- compatibility and deliberately ignored.
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_amount, v_count
  FROM rewards
  WHERE id = ANY(p_reward_ids) AND user_id = auth.uid();

  IF v_count <> array_length(p_reward_ids, 1) THEN
    RAISE EXCEPTION 'One or more selected rewards could not be found';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Payout amount must be greater than zero';
  END IF;

  INSERT INTO payout_requests (
    requestor_id, requestor_role, linked_reward_ids,
    linked_student_names, amount, admin_notes, payment_method
  )
  VALUES (
    auth.uid(), p_requestor_role, p_reward_ids,
    p_student_names, v_amount, left(COALESCE(p_notes, ''), 1000), p_payment_method
  )
  RETURNING id INTO v_new_id;

  UPDATE rewards
  SET status = 'approved', payout_requested_at = NOW()
  WHERE id = ANY(p_reward_ids);

  RETURN v_new_id;
END;
$function$;

-- ============================================================
-- 3. get_forgotten_cases: staff only
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_forgotten_cases()
 RETURNS SETOF cases
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.* FROM public.cases c
  CROSS JOIN (SELECT * FROM public.platform_settings LIMIT 1) ps
  WHERE (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'team_member'::app_role)
    )
    AND c.deleted_at IS NULL
    AND c.status NOT IN ('enrollment_paid', 'cancelled', 'forgotten')
    AND (
      (c.status = 'new'       AND c.last_activity_at < now() - (ps.forgotten_new_case_days || ' days')::interval)
      OR (c.status = 'contacted' AND c.last_activity_at < now() - (ps.forgotten_contacted_days || ' days')::interval)
      OR c.is_no_show = true
    )
$function$;

-- ============================================================
-- 4. log_activity: attribution cannot be forged
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_activity(p_actor_id uuid, p_actor_name text, p_action text, p_entity_type text, p_entity_id uuid DEFAULT NULL::uuid, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_actor_name text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- p_actor_id / p_actor_name are ignored: attribution always comes from the
  -- authenticated session so it cannot be spoofed by the caller.
  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;

  INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
  VALUES (
    v_actor_id,
    COALESCE(v_actor_name, 'unknown'),
    left(COALESCE(p_action, ''), 200),
    left(COALESCE(p_entity_type, ''), 100),
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$function$;

-- ============================================================
-- 5. profiles: lock down sensitive self-service fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.restrict_profiles_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.commission_amount := 0;
    NEW.student_status := 'not_applied';
    NEW.visa_status := 'not_applied';
    NEW.must_change_password := false;
    NEW.case_id := NULL;
    NEW.linked_case_id := NULL;
    NEW.deleted_at := NULL;
    NEW.iban_confirmed_at := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.commission_amount IS DISTINCT FROM OLD.commission_amount THEN
      RAISE EXCEPTION 'Non-admin users cannot change commission_amount';
    END IF;
    IF NEW.student_status IS DISTINCT FROM OLD.student_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change student_status';
    END IF;
    IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
      RAISE EXCEPTION 'Non-admin users cannot change visa_status';
    END IF;
    IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
      RAISE EXCEPTION 'Non-admin users cannot change must_change_password';
    END IF;
    IF NEW.case_id IS DISTINCT FROM OLD.case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change case_id';
    END IF;
    IF NEW.linked_case_id IS DISTINCT FROM OLD.linked_case_id THEN
      RAISE EXCEPTION 'Non-admin users cannot change linked_case_id';
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change deleted_at';
    END IF;
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code';
    END IF;
    IF NEW.referral_code_enabled IS DISTINCT FROM OLD.referral_code_enabled THEN
      RAISE EXCEPTION 'Non-admin users cannot change referral_code_enabled';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Non-admin users cannot change the profile id';
    END IF;
    -- Email identifies the account: it is set from auth, never by the client.
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Non-admin users cannot change email';
    END IF;
    -- Only an admin marks bank details as verified.
    IF NEW.iban_confirmed_at IS DISTINCT FROM OLD.iban_confirmed_at THEN
      RAISE EXCEPTION 'Non-admin users cannot change iban_confirmed_at';
    END IF;
    -- Bank details are owner-editable until an admin confirms them; after
    -- confirmation they are frozen so a payout destination cannot be swapped.
    IF OLD.iban_confirmed_at IS NOT NULL AND (
         NEW.iban IS DISTINCT FROM OLD.iban
      OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
      OR NEW.bank_branch IS DISTINCT FROM OLD.bank_branch
      OR NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number
    ) THEN
      RAISE EXCEPTION 'Confirmed bank details can only be changed by an admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 6. Public apply flow: drop legacy overload, tighten validation
-- ============================================================
DROP FUNCTION IF EXISTS public.insert_lead_from_apply(text, text, text, integer, integer, text, text, text, text, text, boolean, text, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.insert_lead_from_apply(p_full_name text, p_phone text, p_passport_type text DEFAULT NULL::text, p_english_units integer DEFAULT NULL::integer, p_math_units integer DEFAULT NULL::integer, p_city text DEFAULT NULL::text, p_education_level text DEFAULT NULL::text, p_german_level text DEFAULT NULL::text, p_budget_range text DEFAULT NULL::text, p_preferred_city text DEFAULT NULL::text, p_accommodation boolean DEFAULT false, p_source_type text DEFAULT 'organic'::text, p_source_id uuid DEFAULT NULL::uuid, p_companion_name text DEFAULT NULL::text, p_companion_phone text DEFAULT NULL::text, p_preferred_major text DEFAULT NULL::text, p_ref_code text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_score integer := 0;
  v_reasons text[] := ARRAY[]::text[];
  v_status text := 'new';
  v_main_lead_id uuid;
  v_companion_lead_id uuid;
  v_ref_owner uuid;
  v_method text := 'organic';
  v_free text[];
  v_val text;
BEGIN
  p_full_name := btrim(COALESCE(p_full_name, ''));
  p_phone     := btrim(COALESCE(p_phone, ''));

  -- Reject control characters, HTML and links in any free-text field.
  v_free := ARRAY[
    p_full_name, COALESCE(p_city, ''), COALESCE(p_preferred_city, ''),
    COALESCE(p_preferred_major, ''), COALESCE(p_companion_name, ''),
    COALESCE(p_education_level, ''), COALESCE(p_german_level, ''),
    COALESCE(p_budget_range, ''), COALESCE(p_passport_type, '')
  ];
  FOREACH v_val IN ARRAY v_free LOOP
    IF v_val ~ '[\x00-\x1F\x7F]' THEN
      RAISE EXCEPTION 'Input contains invalid control characters';
    END IF;
    IF v_val ~* '(<[a-z/!]|https?://|javascript:|\{\{)' THEN
      RAISE EXCEPTION 'Input must not contain markup or links';
    END IF;
  END LOOP;

  IF length(p_full_name) < 2 OR length(p_full_name) > 100 THEN
    RAISE EXCEPTION 'Full name must be between 2 and 100 characters';
  END IF;
  IF p_full_name !~ '[[:alpha:]]' THEN
    RAISE EXCEPTION 'Full name must contain letters';
  END IF;
  IF p_phone !~ '^[0-9+\-\s()]{7,20}$' THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;
  IF length(COALESCE(p_city, '')) > 100
     OR length(COALESCE(p_education_level, '')) > 50
     OR length(COALESCE(p_german_level, '')) > 50
     OR length(COALESCE(p_budget_range, '')) > 50
     OR length(COALESCE(p_preferred_city, '')) > 100
     OR length(COALESCE(p_preferred_major, '')) > 150
     OR length(COALESCE(p_passport_type, '')) > 50
     OR length(COALESCE(p_source_type, '')) > 50
     OR length(COALESCE(p_ref_code, '')) > 40 THEN
    RAISE EXCEPTION 'One or more fields exceed the maximum allowed length';
  END IF;
  IF p_ref_code IS NOT NULL AND btrim(p_ref_code) <> ''
     AND btrim(p_ref_code) !~ '^[A-Za-z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Invalid referral code format';
  END IF;
  IF p_english_units IS NOT NULL AND (p_english_units < 0 OR p_english_units > 10) THEN
    RAISE EXCEPTION 'English units must be between 0 and 10';
  END IF;
  IF p_math_units IS NOT NULL AND (p_math_units < 0 OR p_math_units > 10) THEN
    RAISE EXCEPTION 'Math units must be between 0 and 10';
  END IF;
  IF p_companion_name IS NOT NULL AND btrim(p_companion_name) <> ''
     AND length(btrim(p_companion_name)) > 100 THEN
    RAISE EXCEPTION 'Companion name must be at most 100 characters';
  END IF;
  IF p_companion_phone IS NOT NULL AND btrim(p_companion_phone) <> ''
     AND btrim(p_companion_phone) !~ '^[0-9+\-\s()]{7,20}$' THEN
    RAISE EXCEPTION 'Invalid companion phone number format';
  END IF;

  -- Referral code wins over any client-supplied source, and is resolved server-side.
  IF p_ref_code IS NOT NULL AND btrim(p_ref_code) <> '' THEN
    v_ref_owner := public.resolve_referral_code(p_ref_code);
    IF v_ref_owner IS NOT NULL THEN
      p_source_id := v_ref_owner;
      v_method := 'link';
      IF public.has_role(v_ref_owner, 'social_media_partner'::app_role)
         OR public.has_role(v_ref_owner, 'ambassador'::app_role) THEN
        p_source_type := 'influencer';
      ELSE
        p_source_type := 'referral';
      END IF;
    END IF;
  END IF;

  IF v_method <> 'link' THEN
    -- No trusted code: never trust a raw source_id from the client.
    p_source_type := 'organic';
    p_source_id := NULL;
  END IF;

  IF p_passport_type = 'israeli_blue' THEN
    v_score := v_score + 30;
  ELSIF p_passport_type = 'israeli_red' THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Passport: ' || COALESCE(p_passport_type, 'unknown'));
  END IF;

  IF COALESCE(p_english_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'English units: ' || COALESCE(p_english_units::text, '0') || ' (min 4)');
  END IF;

  IF COALESCE(p_math_units, 0) >= 4 THEN
    v_score := v_score + 20;
  ELSE
    v_reasons := array_append(v_reasons, 'Math units: ' || COALESCE(p_math_units::text, '0') || ' (min 4)');
  END IF;

  IF p_education_level IN ('bagrut', 'bachelor', 'master') THEN
    v_score := v_score + 10;
  END IF;
  IF p_german_level IN ('intermediate', 'advanced') THEN
    v_score := v_score + 10;
  END IF;
  IF v_score < 30 THEN v_status := 'not_eligible'; END IF;

  INSERT INTO leads (
    full_name, phone, passport_type, english_units, math_units, city,
    education_level, german_level, budget_range, preferred_city,
    accommodation, source_type, source_id, status, eligibility_score,
    eligibility_reason, preferred_major, source_attribution_method
  )
  VALUES (
    p_full_name, p_phone, p_passport_type, p_english_units, p_math_units, p_city,
    p_education_level, p_german_level, p_budget_range, p_preferred_city,
    p_accommodation, p_source_type, p_source_id, v_status, v_score,
    array_to_string(v_reasons, '; '), p_preferred_major, v_method
  )
  RETURNING id INTO v_main_lead_id;

  IF p_companion_name IS NOT NULL AND p_companion_phone IS NOT NULL
     AND btrim(p_companion_name) <> '' AND btrim(p_companion_phone) <> '' THEN
    INSERT INTO leads (
      full_name, phone, source_type, source_id, companion_lead_id,
      notes, status, eligibility_score, source_attribution_method
    )
    VALUES (
      btrim(p_companion_name), btrim(p_companion_phone), p_source_type, p_source_id,
      v_main_lead_id, 'Companion of ' || p_full_name || ' (' || p_phone || ')',
      'new', 0, v_method
    )
    RETURNING id INTO v_companion_lead_id;

    UPDATE leads SET companion_lead_id = v_companion_lead_id WHERE id = v_main_lead_id;
  END IF;
END;
$function$;

-- ============================================================
-- 7. Execute privileges: minimal public surface
-- ============================================================
-- Obsolete: the 'influencer' role no longer exists in app_role.
DROP FUNCTION IF EXISTS public.validate_influencer_ref(uuid);

-- Internal helper, only called from other SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.resolve_referral_code(text) FROM PUBLIC, anon, authenticated;

-- Public apply entry point: explicit grants only, no PUBLIC.
REVOKE ALL ON FUNCTION public.insert_lead_from_apply(text, text, text, integer, integer, text, text, text, text, text, boolean, text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_lead_from_apply(text, text, text, integer, integer, text, text, text, text, text, boolean, text, uuid, text, text, text, text) TO anon, authenticated;

-- Staff-only helpers should never be callable straight from a browser session.
REVOKE ALL ON FUNCTION public.get_influencer_lead_ids(uuid) FROM PUBLIC, anon, authenticated;