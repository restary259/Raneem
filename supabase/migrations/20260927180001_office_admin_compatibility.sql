-- DARB Office admin compatibility bridge
-- Route the existing Admin Office page's 7-argument save through the hardened
-- configuration function introduced in the previous migration.

CREATE OR REPLACE FUNCTION public.save_office_configuration(
  p_office_id uuid,
  p_office jsonb,
  p_settings jsonb,
  p_hours jsonb,
  p_primary_user_id uuid DEFAULT NULL,
  p_backup_user_id uuid DEFAULT NULL,
  p_routing_rules jsonb DEFAULT '[]'::jsonb
)
RETURNS public.offices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_members jsonb := '[]'::jsonb;
BEGIN
  IF p_primary_user_id IS NOT NULL THEN
    v_members := v_members || jsonb_build_array(jsonb_build_object(
      'user_id', p_primary_user_id,
      'membership_type', 'operator',
      'is_primary', true,
      'is_active', true,
      'priority', 1
    ));
  END IF;

  IF p_backup_user_id IS NOT NULL THEN
    v_members := v_members || jsonb_build_array(jsonb_build_object(
      'user_id', p_backup_user_id,
      'membership_type', 'backup',
      'is_primary', false,
      'is_active', true,
      'priority', 2
    ));
  END IF;

  RETURN public.admin_save_office_configuration(
    p_office_id,
    p_office,
    p_settings,
    p_hours,
    v_members,
    p_routing_rules,
    '[]'::jsonb,
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_office_configuration(uuid,jsonb,jsonb,jsonb,uuid,uuid,jsonb)
  TO authenticated;
