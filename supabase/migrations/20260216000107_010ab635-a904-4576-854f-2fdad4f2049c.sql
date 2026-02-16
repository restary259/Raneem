
-- Add IBAN and bank fields to profiles for payout validation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS iban_confirmed_at TIMESTAMPTZ;

-- Add last_contacted to leads if not already there (for SLA tracking)
-- It already exists per schema, so skip

-- Add stale flag for SLA automation
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT false;

-- Add assigned_at to student_cases for SLA tracking
ALTER TABLE public.student_cases
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
