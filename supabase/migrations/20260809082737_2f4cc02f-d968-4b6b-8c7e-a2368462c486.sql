-- 1. push_subscriptions: device metadata + health
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_status integer,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key
  ON public.push_subscriptions (endpoint);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- 2. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  cat_messages boolean NOT NULL DEFAULT true,
  cat_appointments boolean NOT NULL DEFAULT true,
  cat_cases boolean NOT NULL DEFAULT true,
  cat_payments boolean NOT NULL DEFAULT true,
  cat_documents boolean NOT NULL DEFAULT true,
  cat_profile boolean NOT NULL DEFAULT true,
  cat_recruitment boolean NOT NULL DEFAULT true,
  cat_system boolean NOT NULL DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. push_delivery_log (no message content)
CREATE TABLE IF NOT EXISTS public.push_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid,
  user_id uuid NOT NULL,
  subscription_id uuid,
  endpoint_hash text,
  status_code integer,
  result text NOT NULL,
  error_reason text,
  attempt integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_delivery_log_user_idx ON public.push_delivery_log (user_id, created_at DESC);

GRANT SELECT ON public.push_delivery_log TO authenticated;
GRANT ALL ON public.push_delivery_log TO service_role;

ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read push delivery log" ON public.push_delivery_log;
CREATE POLICY "Admins read push delivery log"
  ON public.push_delivery_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. notifications: category / priority / dedupe
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Derive category from the existing `source` values so historic and
-- trigger-produced rows land in the right preference bucket.
CREATE OR REPLACE FUNCTION public.notification_category_for_source(_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _source IN ('direct_message', 'case_message', 'chat') THEN 'messages'
    WHEN _source IN ('appointment', 'appointment_reminder') THEN 'appointments'
    WHEN _source IN ('case', 'case_status', 'case_event', 'student_profile_updated') THEN 'cases'
    WHEN _source IN ('payout', 'payment', 'commission') THEN 'payments'
    WHEN _source IN ('document', 'document_request') THEN 'documents'
    WHEN _source IN ('profile', 'profile_incomplete') THEN 'profile'
    WHEN _source IN ('recruit', 'recruitment', 'partner_recruit') THEN 'recruitment'
    ELSE 'system'
  END
$$;

-- 5. Delivery queue: notifications enqueue themselves, nothing blocks.
SELECT pgmq.create('push_notifications');

CREATE OR REPLACE FUNCTION public.enqueue_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category IS NULL OR NEW.category = 'system' THEN
    NEW.category := public.notification_category_for_source(NEW.source);
  END IF;

  PERFORM pgmq.send(
    'push_notifications',
    jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_push ON public.notifications;
CREATE TRIGGER trg_enqueue_push
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_for_notification();