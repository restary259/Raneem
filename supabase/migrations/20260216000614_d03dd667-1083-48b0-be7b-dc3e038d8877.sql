
-- Add Israeli bank account fields to profiles (for influencers)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Add fraud detection columns to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS fraud_flags TEXT[] DEFAULT '{}';

-- Add fraud_flagged to student_cases
ALTER TABLE public.student_cases ADD COLUMN IF NOT EXISTS fraud_flagged BOOLEAN DEFAULT false;
ALTER TABLE public.student_cases ADD COLUMN IF NOT EXISTS fraud_notes TEXT;
