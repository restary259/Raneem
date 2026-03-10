
CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  v_service_fee integer := 0;
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      SELECT COALESCE(service_fee, 0)::integer INTO v_service_fee
      FROM public.case_submissions WHERE case_id = NEW.id LIMIT 1;
      PERFORM record_case_commission(NEW.id, v_service_fee);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
