ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_to_team boolean NOT NULL DEFAULT true;