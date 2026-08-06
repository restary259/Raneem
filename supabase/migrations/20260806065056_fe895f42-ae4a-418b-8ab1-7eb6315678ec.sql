CREATE TABLE public.pipeline_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  color text NOT NULL DEFAULT 'slate',
  sort_order integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pipeline_statuses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pipeline_statuses TO authenticated;
GRANT ALL ON public.pipeline_statuses TO service_role;

ALTER TABLE public.pipeline_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read pipeline statuses"
ON public.pipeline_statuses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert pipeline statuses"
ON public.pipeline_statuses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pipeline statuses"
ON public.pipeline_statuses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pipeline statuses"
ON public.pipeline_statuses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pipeline_statuses_updated_at
BEFORE UPDATE ON public.pipeline_statuses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.guard_pipeline_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.key IS DISTINCT FROM OLD.key THEN
      RAISE EXCEPTION 'The stage key cannot be changed';
    END IF;
    IF OLD.is_active AND NOT NEW.is_active THEN
      SELECT COUNT(*) INTO v_count FROM public.cases
      WHERE status = OLD.key AND deleted_at IS NULL AND NOT archived;
      IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot deactivate a stage that still holds % case(s)', v_count;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT COUNT(*) INTO v_count FROM public.cases WHERE status = OLD.key;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete a stage that still holds % case(s)', v_count;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_pipeline_status_changes
BEFORE UPDATE OR DELETE ON public.pipeline_statuses
FOR EACH ROW EXECUTE FUNCTION public.guard_pipeline_status_changes();

INSERT INTO public.pipeline_statuses (key, label_ar, label_en, color, sort_order, is_terminal, is_active) VALUES
  ('new', 'جديد', 'New', 'blue', 1, false, true),
  ('contacted', 'تم التواصل', 'Contacted', 'yellow', 2, false, true),
  ('appointment_scheduled', 'موعد محدد', 'Appointment', 'purple', 3, false, true),
  ('profile_completion', 'استكمال الملف', 'Profile', 'orange', 4, false, true),
  ('payment_confirmed', 'تأكيد الدفع', 'Payment Confirmed', 'teal', 5, false, true),
  ('submitted', 'تم التقديم', 'Submitted', 'indigo', 6, false, true),
  ('enrollment_paid', 'مسجل', 'Enrolled', 'green', 7, true, true),
  ('forgotten', 'منسي', 'Forgotten', 'red', 8, true, true),
  ('cancelled', 'ملغي', 'Cancelled', 'gray', 9, true, true);