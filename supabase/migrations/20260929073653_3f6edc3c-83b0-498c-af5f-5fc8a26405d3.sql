REVOKE EXECUTE ON FUNCTION public.confirm_agency_service_fee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_effective_agent_self_referral(uuid) FROM PUBLIC, anon, authenticated;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='whatsapp_apply_marketing_opt_out' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_agency_service_fee(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_effective_agent_self_referral(uuid) TO service_role;