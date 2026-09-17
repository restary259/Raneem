CREATE OR REPLACE FUNCTION public.save_case_intel_intake(
  p_case_id uuid,
  p_intake jsonb
)
RETURNS TABLE (
  intel_student_intake jsonb,
  intel_intake_updated_at timestamptz,
  intel_intake_updated_by uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_actor uuid := auth.uid();
  v_allowed_keys constant text[] := ARRAY[
    'bagrutYear', 'fullBagrut', 'bagrutAverage', 'mathUnits', 'mathGrade',
    'englishUnits', 'englishGrade', 'furtherSubject', 'furtherUnits',
    'furtherGrade', 'germanLevel', 'germanCertificate', 'germanCertificateDate'
  ];
  v_key text;
  v_clean jsonb := '{}'::jsonb;
  v_number numeric;
  v_text text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_case
  FROM public.cases
  WHERE id = p_case_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND';
  END IF;

  IF NOT (
    public.is_admin_session()
    OR (public.has_role(v_actor, 'team_member'::public.app_role) AND v_case.assigned_to = v_actor)
  ) THEN
    RAISE EXCEPTION 'INTEL_INTAKE_FORBIDDEN';
  END IF;

  IF p_intake IS NULL OR jsonb_typeof(p_intake) <> 'object' THEN
    RAISE EXCEPTION 'INTEL_INTAKE_INVALID';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_intake)
  LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'INTEL_INTAKE_UNKNOWN_FIELD:%', v_key;
    END IF;
  END LOOP;

  FOREACH v_key IN ARRAY ARRAY['bagrutAverage','mathUnits','mathGrade','englishUnits','englishGrade','furtherUnits','furtherGrade']
  LOOP
    IF p_intake ? v_key AND jsonb_typeof(p_intake -> v_key) <> 'null' THEN
      IF jsonb_typeof(p_intake -> v_key) <> 'number' THEN
        RAISE EXCEPTION 'INTEL_INTAKE_INVALID_NUMBER:%', v_key;
      END IF;
      v_number := (p_intake ->> v_key)::numeric;
      IF v_number < 0 OR v_number > 100 THEN
        RAISE EXCEPTION 'INTEL_INTAKE_NUMBER_OUT_OF_RANGE:%', v_key;
      END IF;
      IF v_key IN ('mathUnits','englishUnits','furtherUnits') THEN
        IF v_number <> trunc(v_number) THEN
          RAISE EXCEPTION 'INTEL_INTAKE_UNITS_MUST_BE_INTEGER:%', v_key;
        END IF;
        IF v_number < 1 OR v_number > 5 THEN
          RAISE EXCEPTION 'INTEL_INTAKE_UNITS_OUT_OF_RANGE:%', v_key;
        END IF;
      END IF;
      v_clean := v_clean || jsonb_build_object(v_key, v_number);
    END IF;
  END LOOP;

  IF p_intake ? 'fullBagrut' AND jsonb_typeof(p_intake -> 'fullBagrut') <> 'null' THEN
    IF jsonb_typeof(p_intake -> 'fullBagrut') <> 'boolean' THEN
      RAISE EXCEPTION 'INTEL_INTAKE_INVALID_BOOLEAN:fullBagrut';
    END IF;
    v_clean := v_clean || jsonb_build_object('fullBagrut', p_intake -> 'fullBagrut');
  END IF;

  FOREACH v_key IN ARRAY ARRAY['bagrutYear','furtherSubject','germanCertificate','germanCertificateDate']
  LOOP
    IF p_intake ? v_key AND jsonb_typeof(p_intake -> v_key) <> 'null' THEN
      IF jsonb_typeof(p_intake -> v_key) <> 'string' THEN
        RAISE EXCEPTION 'INTEL_INTAKE_INVALID_TEXT:%', v_key;
      END IF;
      v_text := btrim(p_intake ->> v_key);
      IF length(v_text) > 160 THEN
        RAISE EXCEPTION 'INTEL_INTAKE_TEXT_TOO_LONG:%', v_key;
      END IF;
      IF v_text <> '' THEN
        v_clean := v_clean || jsonb_build_object(v_key, v_text);
      END IF;
    END IF;
  END LOOP;

  IF v_clean ? 'bagrutYear' AND (v_clean ->> 'bagrutYear') !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'INTEL_INTAKE_INVALID_YEAR';
  END IF;

  IF p_intake ? 'germanLevel' AND jsonb_typeof(p_intake -> 'germanLevel') <> 'null' THEN
    v_text := p_intake ->> 'germanLevel';
    IF v_text NOT IN ('A1','A2','B1','B2','C1','C2') THEN
      RAISE EXCEPTION 'INTEL_INTAKE_INVALID_GERMAN_LEVEL';
    END IF;
    v_clean := v_clean || jsonb_build_object('germanLevel', v_text);
  END IF;

  UPDATE public.cases
  SET intel_student_intake = v_clean,
      intel_intake_updated_at = now(),
      intel_intake_updated_by = v_actor,
      bagrut_score = CASE WHEN v_clean ? 'bagrutAverage' THEN (v_clean ->> 'bagrutAverage')::numeric ELSE bagrut_score END,
      math_units = CASE WHEN v_clean ? 'mathUnits' THEN (v_clean ->> 'mathUnits')::integer ELSE math_units END,
      english_units = CASE WHEN v_clean ? 'englishUnits' THEN (v_clean ->> 'englishUnits')::integer ELSE english_units END,
      updated_at = now()
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'major_intake_updated',
    jsonb_build_object('fields', (SELECT jsonb_agg(key ORDER BY key) FROM jsonb_each(v_clean))),
    true
  );

  RETURN QUERY
  SELECT c.intel_student_intake, c.intel_intake_updated_at, c.intel_intake_updated_by
  FROM public.cases c
  WHERE c.id = p_case_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_case_intel_intake(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_case_intel_intake(uuid, jsonb) TO authenticated, service_role;