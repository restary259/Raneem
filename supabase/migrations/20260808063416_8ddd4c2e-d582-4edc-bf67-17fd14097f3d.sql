-- 1. Drop the service -> invoice line sync
DROP TRIGGER IF EXISTS sync_case_service_invoice_line_trg ON public.case_services;
DROP TRIGGER IF EXISTS trg_sync_case_service_invoice_line ON public.case_services;
DROP FUNCTION IF EXISTS public.sync_case_service_invoice_line() CASCADE;
DROP FUNCTION IF EXISTS public.case_events_from_invoice() CASCADE;
DROP FUNCTION IF EXISTS public.assign_invoice_number() CASCADE;

-- 2. Detach invoice references
DROP VIEW IF EXISTS public.invoice_totals CASCADE;
ALTER TABLE public.case_payments DROP COLUMN IF EXISTS invoice_id;
ALTER TABLE public.payments DROP COLUMN IF EXISTS invoice_id;

-- 3. Drop the invoice tables (and the totals view built on them)
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;

-- 4. Case submission review tracking
ALTER TABLE public.case_submissions
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft';
