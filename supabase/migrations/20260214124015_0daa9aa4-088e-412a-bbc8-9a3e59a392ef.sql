
-- =============================================
-- Phase 8: Rewards & Payouts System Tables
-- =============================================

-- 1. payout_requests table
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requestor_id uuid NOT NULL,
  requestor_role text NOT NULL DEFAULT 'student',
  linked_reward_ids uuid[] NOT NULL DEFAULT '{}',
  linked_student_names text[] DEFAULT '{}',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  transaction_ref text,
  reject_reason text,
  admin_notes text,
  approved_by uuid,
  paid_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payout requests"
  ON public.payout_requests FOR SELECT
  USING (auth.uid() = requestor_id);

CREATE POLICY "Users can insert own payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (auth.uid() = requestor_id);

CREATE POLICY "Users can cancel own pending payout requests"
  ON public.payout_requests FOR UPDATE
  USING (auth.uid() = requestor_id AND status = 'pending');

CREATE POLICY "Admins can manage all payout requests"
  ON public.payout_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;

-- 2. transaction_log table (immutable audit)
CREATE TABLE public.transaction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payout_request_id uuid REFERENCES public.payout_requests(id),
  related_student_ids uuid[] DEFAULT '{}',
  amount numeric NOT NULL DEFAULT 0,
  approved_by uuid,
  payment_method text,
  transaction_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view transaction log"
  ON public.transaction_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert transaction log"
  ON public.transaction_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Insert min_payout_threshold config
INSERT INTO public.eligibility_config (field_name, label, weight, is_active)
VALUES ('min_payout_threshold', 'Minimum Payout Threshold (NIS)', 100, true);

-- 4. Notification trigger for payout request status changes
CREATE OR REPLACE FUNCTION public.notify_payout_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify requestor on status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, body, source, metadata)
      VALUES (NEW.requestor_id, 'Payout Approved', 'Your payout request for ' || NEW.amount || ' NIS has been approved.', 'payout', jsonb_build_object('payout_request_id', NEW.id, 'status', NEW.status));
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, body, source, metadata)
      VALUES (NEW.requestor_id, 'Payout Rejected', 'Your payout request was rejected. Reason: ' || COALESCE(NEW.reject_reason, 'N/A'), 'payout', jsonb_build_object('payout_request_id', NEW.id, 'status', NEW.status, 'reason', NEW.reject_reason));
    ELSIF NEW.status = 'paid' THEN
      INSERT INTO public.notifications (user_id, title, body, source, metadata)
      VALUES (NEW.requestor_id, 'Payout Completed', 'Your payout of ' || NEW.amount || ' NIS has been paid via ' || COALESCE(NEW.payment_method, 'transfer') || '.', 'payout', jsonb_build_object('payout_request_id', NEW.id, 'status', NEW.status, 'payment_method', NEW.payment_method));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_payout_status_notify
  AFTER UPDATE ON public.payout_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payout_status_change();
