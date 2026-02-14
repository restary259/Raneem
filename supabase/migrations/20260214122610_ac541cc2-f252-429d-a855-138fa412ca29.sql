
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update own notifications (mark read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create trigger for case status change notifications
CREATE OR REPLACE FUNCTION public.notify_case_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.case_status IS DISTINCT FROM OLD.case_status AND NEW.student_profile_id IS NOT NULL THEN
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

CREATE TRIGGER trg_case_status_notify
  AFTER UPDATE OF case_status ON public.student_cases
  FOR EACH ROW EXECUTE FUNCTION public.notify_case_status_change();

-- Index for fast user lookups
CREATE INDEX idx_notifications_user_id ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE is_read = false;
