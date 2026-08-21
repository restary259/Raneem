DROP POLICY IF EXISTS "partner_links_owner_insert" ON public.partner_links;
CREATE POLICY "partner_links_owner_insert" ON public.partner_links FOR INSERT TO authenticated
WITH CHECK (
  partner_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'social_media_partner')
    OR public.has_role(auth.uid(), 'ambassador')
    OR public.has_role(auth.uid(), 'agent')
  )
);