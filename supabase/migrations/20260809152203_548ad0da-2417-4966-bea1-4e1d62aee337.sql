-- 1. One identity = one role
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_one_role_per_user ON public.user_roles (user_id);

-- 2. Deactivation metadata
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_by uuid,
  ADD COLUMN IF NOT EXISTS deactivated_reason text;

-- 3. Identity conflict lookup (admin only)
CREATE OR REPLACE FUNCTION public.check_identity_conflict(_email text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  r app_role;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, email, full_name, deleted_at INTO p
  FROM public.profiles
  WHERE lower(email) = lower(trim(_email))
  LIMIT 1;

  IF p.id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT role INTO r FROM public.user_roles WHERE user_id = p.id LIMIT 1;

  RETURN jsonb_build_object(
    'exists', true,
    'user_id', p.id,
    'full_name', p.full_name,
    'role', r,
    'deactivated', p.deleted_at IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_identity_conflict(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_identity_conflict(text) TO authenticated, service_role;

-- 4. Deactivate an account (never deletes the auth identity or business records)
CREATE OR REPLACE FUNCTION public.admin_deactivate_account(_target_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  p record;
  revoked app_role;
  admin_count int;
BEGIN
  IF NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF _target_id = actor THEN
    RAISE EXCEPTION 'You cannot deactivate your own account';
  END IF;

  SELECT id, email, full_name, deleted_at INTO p FROM public.profiles WHERE id = _target_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  -- Idempotent: already deactivated is a no-op success
  IF p.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_deactivated', true);
  END IF;

  SELECT role INTO revoked FROM public.user_roles WHERE user_id = _target_id LIMIT 1;

  IF revoked = 'admin' THEN
    SELECT count(*) INTO admin_count
    FROM public.user_roles ur
    JOIN public.profiles pr ON pr.id = ur.user_id
    WHERE ur.role = 'admin' AND pr.deleted_at IS NULL;
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last remaining admin';
    END IF;
  END IF;

  UPDATE public.profiles
     SET deleted_at = now(),
         deactivated_by = actor,
         deactivated_reason = _reason
   WHERE id = _target_id;

  DELETE FROM public.user_roles WHERE user_id = _target_id;

  INSERT INTO public.deletion_logs (deleted_by, target_type, target_id, categories, mode, snapshot_json)
  VALUES (
    actor, 'account', _target_id, ARRAY['account'], 'deactivate',
    jsonb_build_object('email', p.email, 'full_name', p.full_name, 'role', revoked, 'reason', _reason)
  );

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, details)
  VALUES (actor, 'deactivate_account', _target_id,
          format('Deactivated %s (%s)%s', coalesce(p.email, '?'), coalesce(revoked::text, 'no role'),
                 CASE WHEN _reason IS NULL THEN '' ELSE ' — ' || _reason END));

  RETURN jsonb_build_object('success', true, 'revoked_role', revoked, 'already_deactivated', false);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_deactivate_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_deactivate_account(uuid, text) TO authenticated, service_role;

-- 5. Reactivate an account with exactly one role
CREATE OR REPLACE FUNCTION public.admin_reactivate_account(_target_id uuid, _role app_role)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  p record;
BEGIN
  IF NOT public.has_role(actor, 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, email INTO p FROM public.profiles WHERE id = _target_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  UPDATE public.profiles
     SET deleted_at = NULL, deactivated_by = NULL, deactivated_reason = NULL
   WHERE id = _target_id;

  DELETE FROM public.user_roles WHERE user_id = _target_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_id, _role);

  UPDATE public.deletion_logs
     SET restored_at = now(), restored_by = actor
   WHERE target_id = _target_id AND target_type = 'account' AND restored_at IS NULL;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, details)
  VALUES (actor, 'reactivate_account', _target_id,
          format('Reactivated %s as %s', coalesce(p.email, '?'), _role));

  RETURN jsonb_build_object('success', true, 'role', _role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reactivate_account(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_account(uuid, app_role) TO authenticated, service_role;