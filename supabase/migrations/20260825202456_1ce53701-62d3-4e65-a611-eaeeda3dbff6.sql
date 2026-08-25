ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
UPDATE public.referrals r SET status = 'rewarded'
 WHERE r.status <> 'rewarded'
   AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = r.referred_case_id AND c.commission_split_done);