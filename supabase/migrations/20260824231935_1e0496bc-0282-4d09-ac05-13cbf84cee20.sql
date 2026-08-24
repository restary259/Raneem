CREATE OR REPLACE FUNCTION public.catalog_dependency_report(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n bigint;
  child_programs bigint := 0;
  child_accommodations bigint := 0;
  blocking bigint := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can inspect catalog dependencies';
  END IF;

  IF p_kind = 'school' THEN
    SELECT count(*) INTO n FROM case_submissions WHERE school_id = p_id;
    v := v || jsonb_build_object('case_submissions', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM service_catalog WHERE school_id = p_id;
    v := v || jsonb_build_object('service_catalog', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM important_contacts WHERE language_school_id = p_id;
    v := v || jsonb_build_object('important_contacts', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM profiles WHERE language_school_id = p_id;
    v := v || jsonb_build_object('profiles', n); blocking := blocking + n;

    SELECT count(*) INTO child_programs FROM programs WHERE school_id = p_id;
    SELECT count(*) INTO child_accommodations FROM accommodations WHERE school_id = p_id;

    -- child programs / accommodations block only when THEY are referenced
    SELECT count(*) INTO n FROM case_submissions cs
      WHERE cs.program_id IN (SELECT id FROM programs WHERE school_id = p_id)
         OR cs.accommodation_id IN (SELECT id FROM accommodations WHERE school_id = p_id);
    v := v || jsonb_build_object('child_case_submissions', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM service_catalog sc
      WHERE sc.program_id IN (SELECT id FROM programs WHERE school_id = p_id)
         OR sc.accommodation_id IN (SELECT id FROM accommodations WHERE school_id = p_id);
    v := v || jsonb_build_object('child_service_catalog', n); blocking := blocking + n;

  ELSIF p_kind = 'program' THEN
    SELECT count(*) INTO n FROM case_submissions WHERE program_id = p_id;
    v := v || jsonb_build_object('case_submissions', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM service_catalog WHERE program_id = p_id;
    v := v || jsonb_build_object('service_catalog', n); blocking := blocking + n;

  ELSIF p_kind = 'accommodation' THEN
    SELECT count(*) INTO n FROM case_submissions WHERE accommodation_id = p_id;
    v := v || jsonb_build_object('case_submissions', n); blocking := blocking + n;
    SELECT count(*) INTO n FROM service_catalog WHERE accommodation_id = p_id;
    v := v || jsonb_build_object('service_catalog', n); blocking := blocking + n;

  ELSE
    RAISE EXCEPTION 'Unknown catalog kind: %', p_kind;
  END IF;

  RETURN jsonb_build_object(
    'kind', p_kind,
    'id', p_id,
    'counts', v,
    'child_programs', child_programs,
    'child_accommodations', child_accommodations,
    'blocking_total', blocking,
    'can_delete', blocking = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_dependency_report(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalog_dependency_report(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_catalog_entity(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report jsonb;
  v_name text;
  removed_programs bigint := 0;
  removed_accommodations bigint := 0;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete catalog records';
  END IF;

  report := catalog_dependency_report(p_kind, p_id);

  IF NOT (report->>'can_delete')::boolean THEN
    RAISE EXCEPTION 'CATALOG_DELETE_BLOCKED: this record is still referenced by existing data (%).', report->'counts';
  END IF;

  IF p_kind = 'school' THEN
    SELECT name_en INTO v_name FROM schools WHERE id = p_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'School not found'; END IF;
    DELETE FROM programs WHERE school_id = p_id;
    GET DIAGNOSTICS removed_programs = ROW_COUNT;
    DELETE FROM accommodations WHERE school_id = p_id;
    GET DIAGNOSTICS removed_accommodations = ROW_COUNT;
    DELETE FROM schools WHERE id = p_id;

  ELSIF p_kind = 'program' THEN
    SELECT name_en INTO v_name FROM programs WHERE id = p_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Program not found'; END IF;
    DELETE FROM programs WHERE id = p_id;

  ELSIF p_kind = 'accommodation' THEN
    SELECT name_en INTO v_name FROM accommodations WHERE id = p_id;
    IF v_name IS NULL THEN RAISE EXCEPTION 'Accommodation not found'; END IF;
    DELETE FROM accommodations WHERE id = p_id;

  ELSE
    RAISE EXCEPTION 'Unknown catalog kind: %', p_kind;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, target_table, target_id, details)
  VALUES (
    auth.uid(),
    'catalog_delete',
    CASE p_kind WHEN 'school' THEN 'schools' WHEN 'program' THEN 'programs' ELSE 'accommodations' END,
    p_id::text,
    format('Deleted %s "%s" (child programs: %s, child accommodations: %s)',
           p_kind, coalesce(v_name, '?'), removed_programs, removed_accommodations)
  );

  RETURN jsonb_build_object(
    'deleted', true,
    'kind', p_kind,
    'id', p_id,
    'name', v_name,
    'removed_programs', removed_programs,
    'removed_accommodations', removed_accommodations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_catalog_entity(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_catalog_entity(text, uuid) TO authenticated;