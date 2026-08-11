CREATE OR REPLACE FUNCTION public.deactivate_push_on_account_disable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.push_subscriptions
       SET active = false,
           revoked_at = now(),
           updated_at = now()
     WHERE user_id = NEW.id AND active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_push_on_account_disable ON public.profiles;
CREATE TRIGGER trg_deactivate_push_on_account_disable
AFTER UPDATE OF deleted_at ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.deactivate_push_on_account_disable();