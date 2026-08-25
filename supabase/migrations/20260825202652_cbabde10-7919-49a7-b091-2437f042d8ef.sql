ALTER TABLE public.case_financial_snapshots
  ADD COLUMN IF NOT EXISTS attribution_model TEXT NOT NULL DEFAULT 'additive',
  ADD COLUMN IF NOT EXISTS is_agent_self_referral BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_student_referrer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_referral_type TEXT;

COMMENT ON COLUMN public.case_financial_snapshots.attribution_model IS
  'Commission attribution model frozen when the case reaches enrollment_paid.';
COMMENT ON COLUMN public.case_financial_snapshots.is_agent_self_referral IS
  'Whether the referrer was an agent referring their own student.';
COMMENT ON COLUMN public.case_financial_snapshots.is_student_referrer IS
  'Whether the referrer was a student.';
COMMENT ON COLUMN public.case_financial_snapshots.student_referral_type IS
  'Student referral classification, such as friend or family.';