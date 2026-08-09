DROP POLICY IF EXISTS "Students create referrals" ON public.referrals;

CREATE POLICY "Students create referrals"
ON public.referrals
FOR INSERT
TO authenticated
WITH CHECK (
  referrer_user_id = auth.uid()
  AND discount_applied = false
  AND referred_case_id IS NULL
);