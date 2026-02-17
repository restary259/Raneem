
-- Add arrival_date column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS arrival_date date;

-- Create trigger to notify student via edge function when visa_status changes
CREATE OR REPLACE FUNCTION public.notify_visa_status_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
    -- Insert notification for audit trail
    INSERT INTO public.notifications (user_id, title, body, source, metadata)
    VALUES (
      NEW.id,
      'Visa Status Updated',
      'Your visa status has been updated to: ' || NEW.visa_status,
      'visa_update',
      jsonb_build_object('old_status', OLD.visa_status, 'new_status', NEW.visa_status)
    );
    
    -- Call edge function for email via pg_net
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-event-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'event', 'visa_status_changed',
        'student_email', NEW.email,
        'student_name', NEW.full_name,
        'old_status', OLD.visa_status,
        'new_status', NEW.visa_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS trigger_visa_status_email ON public.profiles;
CREATE TRIGGER trigger_visa_status_email
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_visa_status_email();
