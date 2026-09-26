CREATE OR REPLACE FUNCTION public.create_public_appointment_access(p_case_id uuid,p_token_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id=p_case_id AND source='apply_page' AND created_at > now()-interval '30 minutes') THEN RAISE EXCEPTION 'Not eligible'; END IF;
 INSERT INTO public.public_appointment_access (case_id,token_hash,expires_at) VALUES(p_case_id,p_token_hash,now()+interval '14 days') ON CONFLICT (case_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.create_public_appointment_access(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment_access(uuid,text) TO service_role;