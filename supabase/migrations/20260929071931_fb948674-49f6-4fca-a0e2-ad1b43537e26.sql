ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS whatsapp_sending_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.platform_settings.whatsapp_sending_enabled IS
  'Master switch for all outgoing WhatsApp sending (manual sends, follow-ups and marketing campaigns). Off by default.';

UPDATE public.platform_settings SET whatsapp_sending_enabled = false;