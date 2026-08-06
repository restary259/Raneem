-- 1) Restrict internal configuration tables to staff -------------------------
DROP POLICY IF EXISTS "permissions_read_authenticated" ON public.permissions;
CREATE POLICY "permissions_read_staff" ON public.permissions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team_member'::app_role));

DROP POLICY IF EXISTS "role_permissions_read_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_read_staff" ON public.role_permissions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team_member'::app_role));

DROP POLICY IF EXISTS "Signed-in users can read pipeline statuses" ON public.pipeline_statuses;
CREATE POLICY "pipeline_statuses_read_staff" ON public.pipeline_statuses
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'team_member'::app_role));

-- 2) Document audit trail -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_document_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (
    auth.uid(),
    'document_' || lower(TG_OP),
    COALESCE(NEW.id, OLD.id)::text,
    'documents',
    'student=' || COALESCE(NEW.student_id, OLD.student_id)::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_document_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_documents ON public.documents;
CREATE TRIGGER trg_audit_documents
AFTER INSERT OR UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.audit_document_change();

-- 3) Admin-only anomaly report over document activity -------------------------
CREATE OR REPLACE FUNCTION public.get_document_activity_spikes(
  p_window interval DEFAULT '01:00:00'::interval,
  p_threshold integer DEFAULT 30
)
RETURNS TABLE(actor_id uuid, actor_name text, event_count bigint, last_seen timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.admin_id,
         COALESCE(p.full_name, 'unknown'),
         COUNT(*)::bigint,
         MAX(a.created_at)
  FROM public.admin_audit_log a
  LEFT JOIN public.profiles p ON p.id = a.admin_id
  WHERE a.target_table = 'documents'
    AND a.created_at > now() - p_window
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY a.admin_id, p.full_name
  HAVING COUNT(*) >= p_threshold
  ORDER BY COUNT(*) DESC
$$;

REVOKE ALL ON FUNCTION public.get_document_activity_spikes(interval, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_document_activity_spikes(interval, integer) TO authenticated;

-- 4) Document retention -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_expired_documents(p_retention interval DEFAULT '3 years'::interval)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
  v_count integer := 0;
BEGIN
  SELECT array_agg(d.id) INTO v_ids
  FROM public.documents d
  JOIN public.cases c ON c.id = d.case_id
  WHERE d.deleted_at IS NULL
    AND (c.archived = true OR c.deleted_at IS NOT NULL OR c.status IN ('cancelled', 'enrolled', 'enrollment_paid'))
    AND d.created_at < now() - p_retention;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.documents SET deleted_at = now() WHERE id = ANY(v_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.deletion_logs (deleted_by, target_type, target_id, categories, mode, snapshot_json)
  SELECT COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
         'documents_retention',
         gen_random_uuid(),
         ARRAY['documents'],
         'soft',
         jsonb_build_object('document_ids', to_jsonb(v_ids), 'retention', p_retention::text);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_documents(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_documents(interval) TO service_role;