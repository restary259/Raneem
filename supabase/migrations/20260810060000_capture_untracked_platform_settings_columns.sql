-- Capture two platform_settings columns that exist in the live database but had
-- no ADD COLUMN migration (created directly via the Supabase SQL editor).
--
-- Without these, `supabase db reset` produces a platform_settings table missing
-- team_member_commission_rate (read by record_case_commission and ~10 other
-- functions) and partner_dashboard_show_all_cases (read by the partner
-- dashboard), which would break the entire commission system on a fresh DB.
--
-- This migration is purely additive (IF NOT EXISTS) and changes no existing
-- data. Both columns are restored with the same type and default they carry in
-- production, confirmed against src/integrations/supabase/types.ts.

-- Team commission default (ILS per enrolled student). record_case_commission
-- reads this with COALESCE(..., 100), so the column default mirrors that.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS team_member_commission_rate integer NOT NULL DEFAULT 100;

-- Whether partners see all cases by default (vs. only their referred ones).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS partner_dashboard_show_all_cases boolean NOT NULL DEFAULT false;
