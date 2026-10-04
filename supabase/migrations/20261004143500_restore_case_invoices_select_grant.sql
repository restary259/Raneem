-- Restore the Data API read grant on case_invoices. RLS stays enabled; the
-- existing "Case members read invoices" / "Admins read invoices" policies
-- still limit each user to invoices on their own cases.
GRANT SELECT ON public.case_invoices TO authenticated;
