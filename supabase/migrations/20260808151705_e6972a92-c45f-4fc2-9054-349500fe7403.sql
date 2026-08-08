-- 1. Consent records (append-only)
CREATE TABLE IF NOT EXISTS public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_name text,
  phone text,
  email text,
  source_form text NOT NULL,
  policy_version text NOT NULL,
  service_contact_consent boolean NOT NULL DEFAULT true,
  marketing_consent boolean NOT NULL DEFAULT false,
  marketing_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.consent_records TO anon;
GRANT SELECT, INSERT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;

ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record their consent"
  ON public.consent_records FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read consent records"
  ON public.consent_records FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read their own consent records"
  ON public.consent_records FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_consent_records_phone ON public.consent_records(phone);
CREATE INDEX IF NOT EXISTS idx_consent_records_user ON public.consent_records(user_id);

-- 2. Email category separation
ALTER TABLE public.suppressed_emails
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all';

ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional';

ALTER TABLE public.email_unsubscribe_tokens
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'marketing';

CREATE OR REPLACE FUNCTION public.validate_suppression_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('all', 'marketing') THEN
    RAISE EXCEPTION 'Invalid suppression scope: %', NEW.scope;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_suppression_scope ON public.suppressed_emails;
CREATE TRIGGER trg_validate_suppression_scope
  BEFORE INSERT OR UPDATE ON public.suppressed_emails
  FOR EACH ROW EXECUTE FUNCTION public.validate_suppression_scope();