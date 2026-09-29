CREATE OR REPLACE FUNCTION public.dispatch_whatsapp_marketing_campaigns()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_key text;
  v_enabled boolean;
BEGIN
  SELECT whatsapp_sending_enabled INTO v_enabled
  FROM public.platform_settings
  LIMIT 1;

  IF v_enabled IS DISTINCT FROM true THEN
    RETURN;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_whatsapp_follow_up_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_key text;
  v_enabled boolean;
BEGIN
  SELECT whatsapp_sending_enabled INTO v_enabled
  FROM public.platform_settings
  LIMIT 1;

  IF v_enabled IS DISTINCT FROM true THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'cron_dispatch_secret';

  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE WARNING 'dispatch_whatsapp_follow_up_tasks: vault secret cron_dispatch_secret is missing/empty';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://mzbadxfvxioedzdjxamc.supabase.co/functions/v1/whatsapp-follow-up-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Lovable-Context', 'cron',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  );
END;
$function$;