UPDATE public.profiles p
SET must_change_password = true
WHERE p.must_change_password = false
  AND p.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p.id AND r.role <> 'admin'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_invitations i
    WHERE i.accepted_user_id = p.id AND i.status = 'accepted'
  );