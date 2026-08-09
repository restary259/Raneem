CREATE OR REPLACE FUNCTION public.set_case_services(p_case_id uuid, p_service_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[] := COALESCE(p_service_ids, '{}'::uuid[]);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND c.assigned_to = v_uid)
  ) THEN
    RAISE EXCEPTION 'Not allowed to manage services for this case';
  END IF;

  -- Remove de-selected catalog lines (manually added lines with no service_id are left alone)
  DELETE FROM public.case_services cs
   WHERE cs.case_id = p_case_id
     AND cs.service_id IS NOT NULL
     AND NOT (cs.service_id = ANY (v_ids));

  -- Insert newly selected lines, copying the catalog price at selection time
  INSERT INTO public.case_services (case_id, service_id, description, category, unit_price, quantity, discount, added_by)
  SELECT p_case_id, sc.id, sc.name_en, sc.category, COALESCE(sc.default_price, 0), 1, 0, v_uid
    FROM public.service_catalog sc
   WHERE sc.id = ANY (v_ids)
     AND sc.is_active
     AND NOT EXISTS (
       SELECT 1 FROM public.case_services cs
        WHERE cs.case_id = p_case_id AND cs.service_id = sc.id
     );
END;
$$;

REVOKE ALL ON FUNCTION public.set_case_services(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_case_services(uuid, uuid[]) TO authenticated;

-- Team members may read their case services but no longer write them directly
DROP POLICY IF EXISTS "Team members manage services for their cases" ON public.case_services;
CREATE POLICY "Team members read services for their cases"
  ON public.case_services FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_services.case_id AND c.assigned_to = auth.uid()));