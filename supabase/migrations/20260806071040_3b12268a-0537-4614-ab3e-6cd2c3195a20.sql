CREATE TABLE public.partner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  label text,
  target_path text NOT NULL DEFAULT '/apply',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_links TO authenticated;
GRANT ALL ON public.partner_links TO service_role;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_links_admin_all" ON public.partner_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "partner_links_owner_read" ON public.partner_links FOR SELECT TO authenticated
  USING (partner_id = auth.uid());
CREATE POLICY "partner_links_owner_insert" ON public.partner_links FOR INSERT TO authenticated
  WITH CHECK (partner_id = auth.uid());
CREATE POLICY "partner_links_owner_update" ON public.partner_links FOR UPDATE TO authenticated
  USING (partner_id = auth.uid()) WITH CHECK (partner_id = auth.uid());

CREATE INDEX idx_partner_links_partner ON public.partner_links(partner_id);
CREATE INDEX idx_partner_links_code ON public.partner_links(lower(code));

CREATE TRIGGER trg_partner_links_updated_at BEFORE UPDATE ON public.partner_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_link_id uuid NOT NULL REFERENCES public.partner_links(id) ON DELETE CASCADE,
  session_id text,
  ip_hash text,
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_clicks TO authenticated;
GRANT ALL ON public.partner_clicks TO service_role;
ALTER TABLE public.partner_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_clicks_admin_read" ON public.partner_clicks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "partner_clicks_owner_read" ON public.partner_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_links pl WHERE pl.id = partner_link_id AND pl.partner_id = auth.uid()));

CREATE INDEX idx_partner_clicks_link ON public.partner_clicks(partner_link_id, clicked_at DESC);

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS partner_link_id uuid REFERENCES public.partner_links(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cases_partner_link ON public.cases(partner_link_id);
CREATE INDEX IF NOT EXISTS idx_cases_partner_id ON public.cases(partner_id);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_link_id uuid REFERENCES public.partner_links(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.resolve_partner_link(p_code text)
RETURNS TABLE(link_id uuid, partner_id uuid, partner_name text, target_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pl.id, pl.partner_id, pr.full_name, pl.target_path
  FROM public.partner_links pl
  LEFT JOIN public.profiles pr ON pr.id = pl.partner_id
  WHERE lower(pl.code) = lower(trim(p_code)) AND pl.active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_partner_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_partner_link(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_partner_click(p_code text, p_session_id text, p_user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link uuid;
BEGIN
  SELECT id INTO v_link FROM public.partner_links
  WHERE lower(code) = lower(trim(p_code)) AND active = true LIMIT 1;

  IF v_link IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.partner_clicks
    WHERE partner_link_id = v_link
      AND session_id IS NOT DISTINCT FROM p_session_id
      AND clicked_at > now() - interval '30 minutes'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.partner_clicks (partner_link_id, session_id, user_agent)
  VALUES (v_link, left(coalesce(p_session_id,''), 64), left(coalesce(p_user_agent,''), 300));
END;
$$;

REVOKE ALL ON FUNCTION public.record_partner_click(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_partner_click(text, text, text) TO anon, authenticated, service_role;

-- Seed one default link per existing partner/ambassador that already has a referral code
INSERT INTO public.partner_links (partner_id, code, label, target_path)
SELECT p.id, p.referral_code, 'Default', '/apply'
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.referral_code IS NOT NULL
  AND ur.role IN ('social_media_partner','ambassador')
ON CONFLICT (code) DO NOTHING;