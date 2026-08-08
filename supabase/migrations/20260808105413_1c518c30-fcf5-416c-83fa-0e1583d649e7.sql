CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'team_member' THEN 2
    WHEN 'social_media_partner' THEN 3
    WHEN 'ambassador' THEN 4
    WHEN 'student' THEN 5
    ELSE 6 END
  LIMIT 1
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT '81f7f86b-007d-449a-a8a4-c6e833c5c170'::uuid, 'social_media_partner'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = '81f7f86b-007d-449a-a8a4-c6e833c5c170'
);