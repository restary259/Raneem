ALTER TABLE public.important_contacts
  ADD COLUMN IF NOT EXISTS address_ar text,
  ADD COLUMN IF NOT EXISTS address_en text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'DE',
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;