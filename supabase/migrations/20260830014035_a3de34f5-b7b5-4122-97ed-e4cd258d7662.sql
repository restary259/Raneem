CREATE OR REPLACE FUNCTION public.is_admin_session()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  -- Admin privileges require BOTH the admin role and a completed MFA (AAL2)
  -- challenge. There is no "no factor enrolled" bypass: an AAL1 session (password
  -- only) or a captured AAL1 access token can never satisfy admin RLS policies.
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
     AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2';
$function$;