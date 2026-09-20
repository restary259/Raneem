-- Admin-only, consent-gated WhatsApp marketing campaigns.
-- STAGED ONLY. Do not apply until the final Supabase migration pass.

CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  template_id uuid NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE RESTRICT,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','running','completed','cancelled','failed')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_campaigns_status_schedule_idx
  ON public.whatsapp_campaigns(status, scheduled_at);

CREATE INDEX IF NOT EXISTS whatsapp_campaign_recipients_claim_idx
  ON public.whatsapp_campaign_recipients(status, campaign_id, created_at);

CREATE INDEX IF NOT EXISTS whatsapp_campaign_recipients_campaign_idx
  ON public.whatsapp_campaign_recipients(campaign_id, status);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_campaigns FROM authenticated, anon, public;
REVOKE ALL ON public.whatsapp_campaign_recipients FROM authenticated, anon, public;
GRANT ALL ON public.whatsapp_campaigns TO service_role;
GRANT ALL ON public.whatsapp_campaign_recipients TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_validate_marketing_filters(p_filters jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_filters$
BEGIN
  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> 'object' THEN
    RAISE EXCEPTION 'Invalid marketing filters';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_object_keys(p_filters) k
    WHERE k NOT IN ('intent','language_code','campaign_key','lead_stage','source')
  ) THEN
    RAISE EXCEPTION 'Unsupported marketing filter';
  END IF;
END;
$whatsapp_campaign_filters$;

REVOKE ALL ON FUNCTION public.whatsapp_validate_marketing_filters(jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_marketing_audience_count(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_count$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM public.whatsapp_validate_marketing_filters(p_filters);

  RETURN (
    SELECT count(DISTINCT c.id)
    FROM public.whatsapp_conversations c
    JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
    WHERE wl.marketing_consent_status = 'granted'
      AND (NULLIF(p_filters->>'intent','') IS NULL OR c.intent = p_filters->>'intent')
      AND (NULLIF(p_filters->>'language_code','') IS NULL OR c.language_code = p_filters->>'language_code')
      AND (NULLIF(p_filters->>'campaign_key','') IS NULL OR c.campaign_key = p_filters->>'campaign_key')
      AND (NULLIF(p_filters->>'lead_stage','') IS NULL OR wl.lead_stage = p_filters->>'lead_stage')
      AND (NULLIF(p_filters->>'source','') IS NULL OR wl.source = p_filters->>'source')
  );
END;
$whatsapp_campaign_count$;

REVOKE ALL ON FUNCTION public.whatsapp_marketing_audience_count(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_marketing_audience_count(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_create_marketing_campaign(
  p_name text,
  p_template_id uuid,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_create$
DECLARE
  v_campaign_id uuid;
  v_count bigint;
  v_template_body text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF char_length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Invalid campaign name';
  END IF;

  IF p_scheduled_at IS NOT NULL AND p_scheduled_at <= now() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;

  PERFORM public.whatsapp_validate_marketing_filters(p_filters);

  SELECT coalesce((
    SELECT component->>'text'
    FROM jsonb_array_elements(coalesce(t.components, '[]'::jsonb)) AS component
    WHERE upper(coalesce(component->>'type','')) = 'BODY'
    LIMIT 1
  ), '')
  INTO v_template_body
  FROM public.whatsapp_templates t
  WHERE t.id = p_template_id
    AND t.approval_status = 'APPROVED'
    AND t.is_active = true
    AND t.category = 'MARKETING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only active approved marketing templates can be used';
  END IF;

  IF v_template_body ~ '\\{\\{' THEN
    RAISE EXCEPTION 'Marketing campaign templates with variables are not supported yet';
  END IF;

  v_count := public.whatsapp_marketing_audience_count(p_filters);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No opted-in WhatsApp recipients match the audience filters';
  END IF;

  INSERT INTO public.whatsapp_campaigns (
    name, template_id, filters, status, scheduled_at, created_by
  )
  VALUES (
    btrim(p_name),
    p_template_id,
    coalesce(p_filters, '{}'::jsonb),
    CASE WHEN p_scheduled_at IS NULL THEN 'running' ELSE 'scheduled' END,
    p_scheduled_at,
    auth.uid()
  )
  RETURNING id INTO v_campaign_id;

  INSERT INTO public.whatsapp_campaign_recipients (campaign_id, conversation_id)
  SELECT
    v_campaign_id,
    c.id
  FROM public.whatsapp_conversations c
  JOIN public.whatsapp_leads wl ON wl.id = c.lead_id
  WHERE wl.marketing_consent_status = 'granted'
    AND (NULLIF(p_filters->>'intent','') IS NULL OR c.intent = p_filters->>'intent')
    AND (NULLIF(p_filters->>'language_code','') IS NULL OR c.language_code = p_filters->>'language_code')
    AND (NULLIF(p_filters->>'campaign_key','') IS NULL OR c.campaign_key = p_filters->>'campaign_key')
    AND (NULLIF(p_filters->>'lead_stage','') IS NULL OR wl.lead_stage = p_filters->>'lead_stage')
    AND (NULLIF(p_filters->>'source','') IS NULL OR wl.source = p_filters->>'source')
  ON CONFLICT (campaign_id, conversation_id) DO NOTHING;

  UPDATE public.whatsapp_campaigns
  SET started_at = CASE WHEN p_scheduled_at IS NULL THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_campaign_id;

  RETURN v_campaign_id;
END;
$whatsapp_campaign_create$;

REVOKE ALL ON FUNCTION public.whatsapp_create_marketing_campaign(text,uuid,jsonb,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_create_marketing_campaign(text,uuid,jsonb,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_cancel_marketing_campaign(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_cancel$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.whatsapp_campaigns
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_campaign_id
    AND status IN ('draft','scheduled','running');

  UPDATE public.whatsapp_campaign_recipients
  SET status = 'cancelled', updated_at = now(), processed_at = now()
  WHERE campaign_id = p_campaign_id
    AND status IN ('pending','processing');
END;
$whatsapp_campaign_cancel$;

REVOKE ALL ON FUNCTION public.whatsapp_cancel_marketing_campaign(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_cancel_marketing_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_list_marketing_campaigns(p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  name text,
  template_id uuid,
  template_provider_name text,
  template_language_code text,
  status text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  recipient_total bigint,
  pending_count bigint,
  processing_count bigint,
  sent_count bigint,
  failed_count bigint,
  cancelled_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_list$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.template_id,
    t.provider_name,
    t.language_code,
    c.status,
    c.scheduled_at,
    c.started_at,
    c.completed_at,
    c.created_at,
    count(r.id),
    count(r.id) FILTER (WHERE r.status = 'pending'),
    count(r.id) FILTER (WHERE r.status = 'processing'),
    count(r.id) FILTER (WHERE r.status = 'sent'),
    count(r.id) FILTER (WHERE r.status = 'failed'),
    count(r.id) FILTER (WHERE r.status = 'cancelled')
  FROM public.whatsapp_campaigns c
  JOIN public.whatsapp_templates t ON t.id = c.template_id
  LEFT JOIN public.whatsapp_campaign_recipients r ON r.campaign_id = c.id
  GROUP BY c.id, t.provider_name, t.language_code
  ORDER BY c.created_at DESC
  LIMIT least(greatest(coalesce(p_limit,50),1),100);
END;
$whatsapp_campaign_list$;

REVOKE ALL ON FUNCTION public.whatsapp_list_marketing_campaigns(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_list_marketing_campaigns(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_claim_due_marketing_recipients(p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  campaign_id uuid,
  conversation_id uuid,
  template_id uuid,
  attempt_count integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_claim$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.whatsapp_campaigns
  SET status = 'running',
      started_at = coalesce(started_at, now()),
      updated_at = now()
  WHERE status = 'scheduled'
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= now();

  -- Recover abandoned claims after a worker crash, but never recycle a
  -- terminal recipient.
  UPDATE public.whatsapp_campaign_recipients
  SET status = 'pending',
      updated_at = now()
  WHERE status = 'processing'
    AND attempt_count < max_attempts
    AND updated_at < now() - interval '15 minutes';

  RETURN QUERY
  WITH claimed AS (
    SELECT r.id
    FROM public.whatsapp_campaign_recipients r
    JOIN public.whatsapp_campaigns c ON c.id = r.campaign_id
    WHERE c.status = 'running'
      AND r.attempt_count < r.max_attempts
      AND r.status = 'pending'
      AND r.updated_at <= now() - make_interval(mins => least(power(2, r.attempt_count)::integer, 30))
    ORDER BY c.scheduled_at NULLS FIRST, r.created_at
    FOR UPDATE OF r SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit,25),1),100)
  )
  UPDATE public.whatsapp_campaign_recipients r
  SET status = 'processing',
      attempt_count = r.attempt_count + 1,
      updated_at = now()
  FROM claimed
  WHERE r.id = claimed.id
  RETURNING r.id, r.campaign_id, r.conversation_id, (
    SELECT c.template_id FROM public.whatsapp_campaigns c WHERE c.id = r.campaign_id
  ), r.attempt_count, r.max_attempts;
END;
$whatsapp_campaign_claim$;

REVOKE ALL ON FUNCTION public.whatsapp_claim_due_marketing_recipients(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_claim_due_marketing_recipients(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_complete_marketing_recipient(
  p_recipient_id uuid,
  p_status text,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_campaign_complete$
DECLARE
  v_campaign_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('sent','pending','failed','cancelled') THEN
    RAISE EXCEPTION 'Invalid campaign recipient status';
  END IF;

  UPDATE public.whatsapp_campaign_recipients
  SET status = p_status,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      last_error = left(p_error, 1000),
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
      processed_at = CASE WHEN p_status IN ('sent','failed','cancelled') THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_recipient_id
  RETURNING campaign_id INTO v_campaign_id;

  UPDATE public.whatsapp_campaigns
  SET status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.whatsapp_campaign_recipients r
        WHERE r.campaign_id = v_campaign_id
          AND r.status IN ('pending','processing')
      ) THEN 'running'
      ELSE 'completed'
    END,
    completed_at = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.whatsapp_campaign_recipients r
        WHERE r.campaign_id = v_campaign_id
          AND r.status IN ('pending','processing')
      ) THEN NULL
      ELSE now()
    END,
    updated_at = now()
  WHERE id = v_campaign_id
    AND status NOT IN ('cancelled','failed');
END;
$whatsapp_campaign_complete$;

REVOKE ALL ON FUNCTION public.whatsapp_complete_marketing_recipient(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_complete_marketing_recipient(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_whatsapp_marketing_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $whatsapp_marketing_cron$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'cron_dispatch_secret';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'dispatch_whatsapp_marketing_campaigns: vault secret cron_dispatch_secret is missing/empty';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/whatsapp-marketing-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$whatsapp_marketing_cron$;

REVOKE ALL ON FUNCTION public.dispatch_whatsapp_marketing_campaigns() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-marketing-dispatch'
  ) THEN
    PERFORM cron.schedule(
      'whatsapp-marketing-dispatch',
      '*/5 * * * *',
      'SELECT public.dispatch_whatsapp_marketing_campaigns()'
    );
  END IF;
END;
$$;
