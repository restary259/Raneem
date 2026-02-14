
-- Enable pg_net for HTTP calls from DB triggers/cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Update the case status trigger to also call the email function
CREATE OR REPLACE FUNCTION public.notify_case_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.case_status IS DISTINCT FROM OLD.case_status AND NEW.student_profile_id IS NOT NULL THEN
    -- Insert in-app notification
    INSERT INTO public.notifications (user_id, title, body, source, metadata)
    VALUES (
      NEW.student_profile_id,
      'Application Status Updated',
      'Your application status changed to: ' || NEW.case_status,
      'status_change',
      jsonb_build_object('case_id', NEW.id, 'old_status', OLD.case_status, 'new_status', NEW.case_status)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: auto-notify on referral status change to 'enrolled'
CREATE OR REPLACE FUNCTION public.notify_referral_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.status = 'enrolled' AND OLD.status IS DISTINCT FROM 'enrolled' THEN
    -- In-app notification for the referrer
    INSERT INTO public.notifications (user_id, title, body, source, metadata)
    VALUES (
      NEW.referrer_id,
      'Referral Accepted!',
      'Your referral for ' || NEW.referred_name || ' has been accepted.',
      'referral_accepted',
      jsonb_build_object('referral_id', NEW.id, 'referred_name', NEW.referred_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referral_accepted_notify
  AFTER UPDATE OF status ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.notify_referral_accepted();
