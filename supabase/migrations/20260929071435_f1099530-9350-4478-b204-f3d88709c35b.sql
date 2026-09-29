CREATE OR REPLACE FUNCTION public.whatsapp_claim_due_marketing_recipients(p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, campaign_id uuid, conversation_id uuid, template_id uuid, attempt_count integer, max_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.whatsapp_campaigns wc
  SET status = 'running',
      started_at = coalesce(wc.started_at, now()),
      updated_at = now()
  WHERE wc.status = 'scheduled'
    AND wc.scheduled_at IS NOT NULL
    AND wc.scheduled_at <= now();

  UPDATE public.whatsapp_campaign_recipients sr
  SET status = 'pending',
      updated_at = now()
  WHERE sr.status = 'processing'
    AND sr.attempt_count < sr.max_attempts
    AND sr.updated_at < now() - interval '15 minutes';

  RETURN QUERY
  WITH claimed AS (
    SELECT r.id
    FROM public.whatsapp_campaign_recipients r
    JOIN public.whatsapp_campaigns c ON c.id = r.campaign_id
    WHERE c.status = 'running'
      AND r.attempt_count < r.max_attempts
      AND r.status = 'pending'
      AND r.updated_at <= now() - make_interval(
        mins => CASE
          WHEN r.attempt_count = 0 THEN 0
          ELSE least(power(2, r.attempt_count)::integer, 30)
        END
      )
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
$function$;