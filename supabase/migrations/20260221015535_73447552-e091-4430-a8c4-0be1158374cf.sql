
-- Add new columns to student_cases
ALTER TABLE student_cases
  ADD COLUMN IF NOT EXISTS housing_description TEXT,
  ADD COLUMN IF NOT EXISTS has_translation_service BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paid_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_countdown_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS commission_created boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reassignment boolean DEFAULT false;

-- Index for scheduler efficiency
CREATE INDEX IF NOT EXISTS idx_paid_countdown_started_at ON student_cases(paid_countdown_started_at);
