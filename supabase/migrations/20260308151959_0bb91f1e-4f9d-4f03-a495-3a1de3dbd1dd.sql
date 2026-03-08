CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      auth.uid(),
      'system',
      'status_changed_to_' || NEW.status,
      'case',
      NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;