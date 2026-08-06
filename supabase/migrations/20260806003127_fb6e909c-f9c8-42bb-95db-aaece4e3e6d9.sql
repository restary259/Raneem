CREATE OR REPLACE FUNCTION public.notify_visa_status_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  IF NEW.visa_status IS DISTINCT FROM OLD.visa_status THEN
    INSERT INTO public.notifications (user_id, title, body, source, metadata)
    VALUES (
      NEW.id,
      'Visa Status Updated',
      'Your visa status has been updated to: ' || NEW.visa_status,
      'visa_update',
      jsonb_build_object('old_status', OLD.visa_status, 'new_status', NEW.visa_status)
    );

    v_url := current_setting('app.settings.supabase_url', true);
    v_key := current_setting('app.settings.service_role_key', true);

    -- send-event-email now requires authentication; only call it when the
    -- internal service key is actually configured for this database.
    IF v_url IS NOT NULL AND v_url <> '' AND v_key IS NOT NULL AND v_key <> '' THEN
      PERFORM net.http_post(
        url := v_url || '/functions/v1/send-event-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key
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
  END IF;
  RETURN NEW;
END;
$$;