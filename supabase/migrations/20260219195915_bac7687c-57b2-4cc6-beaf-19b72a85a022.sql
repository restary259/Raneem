ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.audit_lead_source_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_id IS DISTINCT FROM OLD.source_id THEN
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
      VALUES (auth.uid(), 'LEAD_SOURCE_CHANGED', NEW.id::text, 'leads',
        'source_id changed from ' || COALESCE(OLD.source_id::text, 'NULL')
        || ' to ' || COALESCE(NEW.source_id::text, 'NULL')
        || ' | source_type: ' || COALESCE(NEW.source_type, 'NULL'));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action text, p_target_id text DEFAULT NULL,
  p_target_table text DEFAULT NULL, p_details text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (auth.uid(), p_action, p_target_id, p_target_table, p_details);
END; $$;