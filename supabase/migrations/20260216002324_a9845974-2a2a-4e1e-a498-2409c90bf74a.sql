-- Create a SECURITY DEFINER function for audit logging that any authenticated user can call
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_action text,
  p_target_id text DEFAULT NULL,
  p_target_table text DEFAULT NULL,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_table, details)
  VALUES (auth.uid(), p_action, p_target_id, p_target_table, p_details);
END;
$$;