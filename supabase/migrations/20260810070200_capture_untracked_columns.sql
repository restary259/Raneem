-- Phase 1: Capture seven columns that exist in the live database but had no
-- ADD COLUMN migration. Without these, `supabase db reset` creates the tables
-- without these columns, breaking dataService (reads remaining_balance) and
-- the programs admin editor (reads duration_in_months etc.).
--
-- Types/nullability reproduced from src/integrations/supabase/types.ts:
--   * Row is `number` (no `| null`) + Insert has `?:` → NOT NULL with DEFAULT
--   * Row has `| null` + Insert has `?: ... | null` → nullable
-- Additive (IF NOT EXISTS); no data changes.

-- appointments.guest_name: optional guest name for appointments booked without
-- a linked case/student. Nullable text.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- case_submissions.remaining_balance: cached remaining balance (service_fee
-- minus total_paid). NOT NULL numeric, default 0 — dataService reads it with
-- `?? 0` fallback, and the Row shape is `number` (not nullable).
ALTER TABLE public.case_submissions
  ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC NOT NULL DEFAULT 0;

-- programs scheduling metadata used by the admin program editor. All nullable
-- integers (Row shows `number | null`, Insert shows `?: number | null`).
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS duration_in_months INTEGER,
  ADD COLUMN IF NOT EXISTS fixed_start_day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS lessons_per_week INTEGER;
