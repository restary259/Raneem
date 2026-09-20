-- Campaign-recipient idempotency for WhatsApp marketing sends.
-- STAGED ONLY. Do not apply until the final Supabase migration pass.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS campaign_recipient_id uuid
  REFERENCES public.whatsapp_campaign_recipients(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_campaign_recipient_uidx
  ON public.whatsapp_messages(campaign_recipient_id)
  WHERE campaign_recipient_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_messages.campaign_recipient_id IS
  'Links a stored outbound WhatsApp message to its marketing campaign recipient for send idempotency.';
