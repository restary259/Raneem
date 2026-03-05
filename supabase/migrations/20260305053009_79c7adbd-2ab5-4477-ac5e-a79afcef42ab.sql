
-- Phase 1: Add missing columns to cases table
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS education_level text,
  ADD COLUMN IF NOT EXISTS bagrut_score numeric,
  ADD COLUMN IF NOT EXISTS english_level text,
  ADD COLUMN IF NOT EXISTS math_units integer,
  ADD COLUMN IF NOT EXISTS passport_type text,
  ADD COLUMN IF NOT EXISTS degree_interest text,
  ADD COLUMN IF NOT EXISTS intake_notes text;

-- Fix RLS: team_member can only see assigned cases OR cases they created manually
DROP POLICY IF EXISTS "Team can manage cases" ON public.cases;

CREATE POLICY "Team can manage assigned cases"
  ON public.cases FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'team_member'::app_role) AND (
      assigned_to = auth.uid() OR
      source IN ('manual', 'submit_new_student')
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'team_member'::app_role)
  );

-- Audit trigger: log every case status change automatically
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
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

DROP TRIGGER IF EXISTS cases_status_change_trigger ON public.cases;
CREATE TRIGGER cases_status_change_trigger
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();
