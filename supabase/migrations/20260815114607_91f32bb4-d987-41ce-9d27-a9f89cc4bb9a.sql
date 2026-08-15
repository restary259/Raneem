DROP POLICY IF EXISTS "Anyone can record their consent" ON public.consent_records;
CREATE POLICY "Anyone can record their consent"
ON public.consent_records
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own milestones" ON public.referral_milestones;
CREATE POLICY "Users can insert own milestones"
ON public.referral_milestones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'student')
    OR public.has_role(auth.uid(), 'social_media_partner')
    OR public.has_role(auth.uid(), 'ambassador')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Users can update own milestones" ON public.referral_milestones;
CREATE POLICY "Users can update own milestones"
ON public.referral_milestones
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'student')
    OR public.has_role(auth.uid(), 'social_media_partner')
    OR public.has_role(auth.uid(), 'ambassador')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (auth.uid() = user_id);