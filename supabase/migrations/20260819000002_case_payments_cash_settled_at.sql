-- ═══════════════════════════════════════════════════════════════════════
-- Add cash_settled_at to case_payments.
--
-- The frontend (src/components/spreadsheet/sheetQueries.ts) and the
-- generated types (src/integrations/supabase/types.ts) already read this
-- column as `string | null`, but no committed migration created it — the
-- column was added to the live DB out-of-band. This captures it in version
-- control so a fresh `supabase db reset` matches production.
--
-- Nullable timestamptz, no default: populated when a cash payment is
-- physically settled (read-only surface in the spreadsheet export).
-- Idempotent via ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.case_payments
  ADD COLUMN IF NOT EXISTS cash_settled_at timestamptz;
