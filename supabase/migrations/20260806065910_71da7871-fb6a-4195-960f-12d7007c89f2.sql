-- 1. Table
CREATE TABLE public.case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid,
  actor_role text,
  actor_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.case_events TO authenticated;
GRANT ALL ON public.case_events TO service_role;

ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all case events"
ON public.case_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Team members read events for their cases"
ON public.case_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_events.case_id AND c.assigned_to = auth.uid()
  )
);

CREATE POLICY "Students read own visible case events"
ON public.case_events FOR SELECT TO authenticated
USING (
  is_internal = false
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = case_events.case_id AND c.student_user_id = auth.uid()
  )
);

CREATE INDEX idx_case_events_case_created ON public.case_events (case_id, created_at DESC);
CREATE INDEX idx_case_events_type ON public.case_events (event_type);

-- 2. Writer helper (only path into the table)
CREATE OR REPLACE FUNCTION public.log_case_event(
  p_case_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_is_internal boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name  text;
  v_role  text;
BEGIN
  IF p_case_id IS NULL OR p_event_type IS NULL THEN
    RETURN;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT full_name INTO v_name FROM public.profiles WHERE id = v_actor;
    SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_actor LIMIT 1;
  END IF;

  INSERT INTO public.case_events (case_id, event_type, actor_id, actor_role, actor_name, payload, is_internal)
  VALUES (
    p_case_id,
    left(p_event_type, 60),
    v_actor,
    COALESCE(v_role, 'system'),
    COALESCE(v_name, 'System'),
    COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_is_internal, false)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_case_event(uuid, text, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_case_event(uuid, text, jsonb, boolean) TO authenticated, service_role;

-- 3. Triggers
CREATE OR REPLACE FUNCTION public.trg_case_events_cases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_case_event(NEW.id, 'case_created',
      jsonb_build_object('full_name', NEW.full_name, 'source', NEW.source, 'reference', NEW.case_reference));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_case_event(NEW.id, 'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;

  IF NEW.archived IS DISTINCT FROM OLD.archived THEN
    PERFORM public.log_case_event(NEW.id,
      CASE WHEN NEW.archived THEN 'case_archived' ELSE 'case_unarchived' END,
      '{}'::jsonb, true);
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    PERFORM public.log_case_event(NEW.id, 'case_assigned',
      jsonb_build_object('to', NEW.assigned_to), true);
  END IF;

  IF NEW.student_user_id IS DISTINCT FROM OLD.student_user_id AND NEW.student_user_id IS NOT NULL THEN
    PERFORM public.log_case_event(NEW.id, 'student_account_created', '{}'::jsonb);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_events_cases_ins
AFTER INSERT ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_cases();

CREATE TRIGGER trg_case_events_cases_upd
AFTER UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_cases();

CREATE OR REPLACE FUNCTION public.trg_case_events_documents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.case_id IS NOT NULL THEN
    PERFORM public.log_case_event(NEW.case_id, 'document_uploaded',
      jsonb_build_object('file_name', NEW.file_name, 'category', NEW.category),
      NOT COALESCE(NEW.is_visible_to_student, false));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_events_documents_ins
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_documents();

CREATE OR REPLACE FUNCTION public.trg_case_events_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.case_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_case_event(NEW.case_id, 'appointment_scheduled',
      jsonb_build_object('scheduled_at', NEW.scheduled_at, 'duration_minutes', NEW.duration_minutes));
  ELSIF NEW.outcome IS DISTINCT FROM OLD.outcome AND NEW.outcome IS NOT NULL THEN
    PERFORM public.log_case_event(NEW.case_id, 'appointment_outcome',
      jsonb_build_object('outcome', NEW.outcome, 'scheduled_at', NEW.scheduled_at));
  ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    PERFORM public.log_case_event(NEW.case_id, 'appointment_rescheduled',
      jsonb_build_object('from', OLD.scheduled_at, 'to', NEW.scheduled_at));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_events_appointments_ins
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_appointments();

CREATE TRIGGER trg_case_events_appointments_upd
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_appointments();

CREATE OR REPLACE FUNCTION public.trg_case_events_submissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.submitted_at IS NOT NULL THEN
      PERFORM public.log_case_event(NEW.case_id, 'case_submitted', '{}'::jsonb);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.submitted_at IS DISTINCT FROM OLD.submitted_at AND NEW.submitted_at IS NOT NULL THEN
    PERFORM public.log_case_event(NEW.case_id, 'case_submitted', '{}'::jsonb);
  END IF;

  IF NEW.payment_confirmed IS DISTINCT FROM OLD.payment_confirmed AND NEW.payment_confirmed THEN
    PERFORM public.log_case_event(NEW.case_id, 'payment_received',
      jsonb_build_object('amount', NEW.total_paid, 'currency', 'ILS'));
  END IF;

  IF NEW.enrollment_paid_at IS DISTINCT FROM OLD.enrollment_paid_at AND NEW.enrollment_paid_at IS NOT NULL THEN
    PERFORM public.log_case_event(NEW.case_id, 'enrollment_paid',
      jsonb_build_object('service_fee', NEW.service_fee, 'currency', 'ILS'));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_case_events_submissions_ins
AFTER INSERT ON public.case_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_submissions();

CREATE TRIGGER trg_case_events_submissions_upd
AFTER UPDATE ON public.case_submissions
FOR EACH ROW EXECUTE FUNCTION public.trg_case_events_submissions();

REVOKE EXECUTE ON FUNCTION public.trg_case_events_cases() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_case_events_documents() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_case_events_appointments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_case_events_submissions() FROM PUBLIC, anon, authenticated;

-- 4. Backfill from existing data
INSERT INTO public.case_events (case_id, event_type, actor_role, actor_name, payload, created_at)
SELECT c.id, 'case_created', 'system', 'System',
       jsonb_build_object('full_name', c.full_name, 'source', c.source, 'reference', c.case_reference),
       c.created_at
FROM public.cases c;

INSERT INTO public.case_events (case_id, event_type, actor_id, actor_role, actor_name, payload, created_at)
SELECT a.entity_id, 'status_changed', a.actor_id, 'system', COALESCE(a.actor_name, 'System'),
       jsonb_build_object('from', a.metadata->>'from', 'to', a.metadata->>'to'),
       a.created_at
FROM public.activity_log a
JOIN public.cases c ON c.id = a.entity_id
WHERE a.entity_type = 'case' AND a.action LIKE 'status_changed_to_%';