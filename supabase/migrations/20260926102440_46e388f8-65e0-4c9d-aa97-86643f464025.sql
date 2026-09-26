CREATE OR REPLACE FUNCTION public.whatsapp_claim_due_follow_up_tasks(p_limit integer DEFAULT 25)
 RETURNS TABLE(id uuid, conversation_id uuid, kind text, template_id uuid, template_parameters jsonb, attempt_count integer, max_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_whatsapp_staff(auth.uid()) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.whatsapp_follow_up_tasks t
  SET status = 'pending',
      updated_at = now()
  WHERE t.status = 'processing'
    AND t.attempt_count < t.max_attempts
    AND t.updated_at < now() - interval '15 minutes';

  RETURN QUERY
  WITH claimed AS (
    SELECT t.id
    FROM public.whatsapp_follow_up_tasks t
    WHERE t.status = 'pending'
      AND t.due_at <= now()
      AND t.attempt_count < t.max_attempts
    ORDER BY t.due_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(coalesce(p_limit,25),1),100)
  )
  UPDATE public.whatsapp_follow_up_tasks t
  SET status = 'processing',
      attempt_count = t.attempt_count + 1,
      updated_at = now()
  FROM claimed
  WHERE t.id = claimed.id
  RETURNING t.id, t.conversation_id, t.kind, t.template_id, t.template_parameters, t.attempt_count, t.max_attempts;
END;
$function$;