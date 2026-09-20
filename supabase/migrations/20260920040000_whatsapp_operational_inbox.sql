-- WhatsApp operational inbox layer.
-- Staged only: this migration MUST NOT be applied until the final Supabase migration pass.
-- It adds operational metadata to the existing WhatsApp channel; it does not create a second CRM.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS language_code text,
  ADD COLUMN IF NOT EXISTS source_channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS campaign_key text,
  ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_team_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_conversations'::regclass
      AND conname = 'whatsapp_conversations_priority_check'
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_priority_check
      CHECK (priority IN ('normal','high','urgent'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_operational_idx
  ON public.whatsapp_conversations (state, priority, updated_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_snooze_idx
  ON public.whatsapp_conversations (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_sla_idx
  ON public.whatsapp_conversations (sla_due_at)
  WHERE sla_due_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_detect_language(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_text ~ '[\u0600-\u06FF]' THEN
      CASE WHEN p_text ~ '[\u0590-\u05FF]' AND p_text !~ '[\u0620-\u065F]' THEN 'he' ELSE 'ar' END
    WHEN p_text ~ '[A-Za-z]' THEN 'en'
    ELSE 'unknown'
  END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_detect_language(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_detect_language(text) TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_detect_intent(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(p_text) ~ '(طب|medicine|medicin|medizin)' THEN 'medicine'
    WHEN lower(p_text) ~ '(هندس|engineering|ingenieur)' THEN 'engineering'
    WHEN lower(p_text) ~ '(حاسوب|كمبيوتر|برمج|computer|informatik|software)' THEN 'computer_science'
    WHEN lower(p_text) ~ '(لغة|deutsch|german course|sprachkurs)' THEN 'language_course'
    WHEN lower(p_text) ~ '(فيزا|تأشير|visa|visum)' THEN 'visa'
    WHEN lower(p_text) ~ '(سكن|إقام|accommodation|wohnung|unterkunft)' THEN 'accommodation'
    WHEN lower(p_text) ~ '(سعر|تكلف|كم بد|price|cost|preis|kosten)' THEN 'cost'
    WHEN lower(p_text) ~ '(موعد|مقابل|appointment|termin)' THEN 'appointment'
    WHEN lower(p_text) ~ '(مستند|وثائق|ورق|document|unterlagen)' THEN 'documents'
    WHEN lower(p_text) ~ '(وين وصل|حالة الطلب|application status|status|stand meiner)' THEN 'application_status'
    WHEN lower(p_text) ~ '(ملفي|حسابي|طالب حالي|existing student|student support)' THEN 'existing_student'
    ELSE 'other'
  END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_detect_intent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_detect_intent(text) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_whatsapp_conversation_operational_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $whatsapp_operational$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE public.whatsapp_conversations
    SET last_customer_message_at = NEW.created_at,
        last_inbound_at = GREATEST(coalesce(last_inbound_at, NEW.created_at), NEW.created_at),
        last_message_preview = left(coalesce(nullif(NEW.body, ''), NEW.message_type, 'Message'), 240),
        language_code = CASE
          WHEN coalesce(language_code, '') IN ('', 'unknown') THEN public.whatsapp_detect_language(NEW.body)
          ELSE language_code
        END,
        intent = CASE
          WHEN coalesce(intent, '') IN ('', 'other') THEN public.whatsapp_detect_intent(NEW.body)
          ELSE intent
        END,
        sla_due_at = CASE
          WHEN first_response_at IS NULL THEN NEW.created_at + interval '30 minutes'
          ELSE sla_due_at
        END,
        snoozed_until = NULL,
        state = 'waiting_for_team',
        updated_at = now()
    WHERE id = NEW.conversation_id;
  ELSIF NEW.direction = 'outbound' THEN
    UPDATE public.whatsapp_conversations
    SET last_team_response_at = NEW.created_at,
        last_outbound_at = coalesce(NEW.sent_at, NEW.created_at),
        first_response_at = coalesce(first_response_at, CASE WHEN last_inbound_at IS NOT NULL THEN NEW.created_at ELSE NULL END),
        last_message_preview = left(coalesce(nullif(NEW.body, ''), nullif(NEW.template_name, ''), NEW.message_type, 'Message'), 240),
        sla_due_at = NULL,
        state = 'waiting_for_student',
        updated_at = now()
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$whatsapp_operational$;

REVOKE ALL ON FUNCTION public.sync_whatsapp_conversation_operational_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_whatsapp_conversation_operational_state() TO service_role;

DROP TRIGGER IF EXISTS sync_whatsapp_conversation_operational_state ON public.whatsapp_messages;
CREATE TRIGGER sync_whatsapp_conversation_operational_state
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_whatsapp_conversation_operational_state();

-- Keep the newer columns available to the generated client types even when
-- the migration is staged and has not yet been applied.
