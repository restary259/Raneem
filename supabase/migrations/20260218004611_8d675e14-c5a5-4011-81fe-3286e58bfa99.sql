-- Migration 1: Prevent duplicate cases per lead
-- Safe: confirmed all existing cases have unique lead_ids
CREATE UNIQUE INDEX IF NOT EXISTS student_cases_lead_id_key 
ON public.student_cases(lead_id);

-- Migration 2: Prevent duplicate auto-generated rewards per case per user
-- Partial index only covers trigger-generated rows (admin_notes LIKE 'Auto-generated from case%')
CREATE UNIQUE INDEX IF NOT EXISTS rewards_user_case_unique 
ON public.rewards(user_id, admin_notes) 
WHERE admin_notes IS NOT NULL AND admin_notes LIKE 'Auto-generated from case%';