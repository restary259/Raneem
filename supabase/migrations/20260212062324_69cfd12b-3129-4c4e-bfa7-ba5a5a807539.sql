
-- 1. referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referrer_type text NOT NULL DEFAULT 'student',
  referred_name text NOT NULL,
  referred_email text,
  referred_phone text,
  referred_country text,
  referred_city text,
  referred_dob date,
  referred_gender text,
  referred_german_level text,
  is_family boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  referred_student_id uuid,
  notes text,
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Users can insert own referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "Admins can view all referrals" ON public.referrals FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all referrals" ON public.referrals FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete referrals" ON public.referrals FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. rewards table
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ILS',
  status text NOT NULL DEFAULT 'pending',
  payout_requested_at timestamptz,
  paid_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards" ON public.rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rewards" ON public.rewards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all rewards" ON public.rewards FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all rewards" ON public.rewards FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert rewards" ON public.rewards FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. referral_milestones table
CREATE TABLE public.referral_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  milestone_type text NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  notified boolean NOT NULL DEFAULT false
);

ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones" ON public.referral_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own milestones" ON public.referral_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.referral_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all milestones" ON public.referral_milestones FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
