-- guard_case_services_write trusted a plain custom GUC
-- (darb.pricing_engine='on') as proof that the pricing engine was writing.
-- Any authenticated client can run
--   SELECT set_config('darb.pricing_engine', 'on', true);
-- and then UPDATE case_services directly (RLS allows team members to manage
-- services on their own cases), which lets a hand-entered unit_price reach
-- the frozen snapshot used by invoices and financials.
--
-- Hardening: the GUC only counts when current_user <> session_user, i.e. the
-- write is running inside a SECURITY DEFINER function (set_case_services).
-- Client sessions (current_user = session_user = authenticated) can never
-- pass. Admin keeps the direct-write bypass by design, and the RPC path
-- (prices always derived from the admin-managed service_catalog) is
-- unaffected — this changes no grants and no RLS policies.

CREATE OR REPLACE FUNCTION public.guard_case_services_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('darb.pricing_engine', true) = 'on'
     AND current_user <> session_user THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Service lines can only be changed through the pricing engine';
END $$;
