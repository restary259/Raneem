-- Phone-app ("echo") messages never receive a delivery receipt from Meta, so
-- they would sit at 'sent' forever and look like a delivery failure.
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_echo boolean NOT NULL DEFAULT false;

-- Webhook-ingested outbound rows carry a delivery_id; connector-sent rows do not.
UPDATE public.whatsapp_messages
SET is_echo = true
WHERE direction = 'outbound'
  AND delivery_id IS NOT NULL
  AND is_echo = false;

CREATE OR REPLACE FUNCTION public.whatsapp_mark_echo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.delivery_id IS NOT NULL THEN
    NEW.is_echo := true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_whatsapp_mark_echo ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_mark_echo
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_mark_echo();

-- Receipts that never found a message are noise after a month; prune them on
-- the existing drain path so the parked-receipt table cannot grow unbounded.
CREATE OR REPLACE FUNCTION public.whatsapp_prune_pending_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.whatsapp_pending_statuses
  WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.whatsapp_prune_pending_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_prune_pending_statuses() TO service_role;