-- Add must_change_password if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Force all existing admins to change password on next login
UPDATE public.profiles
SET must_change_password = TRUE
WHERE id IN (
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
);

-- Trigger function: any new admin is automatically flagged
CREATE OR REPLACE FUNCTION public.set_admin_must_change_password()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    UPDATE public.profiles SET must_change_password = TRUE
    WHERE id = NEW.user_id AND must_change_password = FALSE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_must_change_password ON public.user_roles;
CREATE TRIGGER trg_admin_must_change_password
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.set_admin_must_change_password();