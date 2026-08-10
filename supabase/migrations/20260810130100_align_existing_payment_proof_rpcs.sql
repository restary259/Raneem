-- The project already has a student-facing proof RPC and Admin review RPC.
-- Keep those existing contracts authoritative and make the new helper names
-- delegate to them instead of creating a second proof workflow.

CREATE OR REPLACE FUNCTION public.submit_german_payment_proof(
  p_case_id uuid,
  p_payment_type text,
  p_file_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.submit_case_payment_proof(
    p_case_id,
    p_payment_type,
    p_file_path,
    NULL
  );
  RETURN COALESCE(v_result, jsonb_build_object('case_id', p_case_id, 'payment_type', p_payment_type));
END;
$$;

CREATE OR REPLACE FUNCTION public.review_german_payment_proof(
  p_proof_id uuid,
  p_approved boolean,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.review_case_payment_proof(
    p_proof_id,
    p_approved,
    p_rejection_reason
  );
  RETURN jsonb_build_object(
    'id', p_proof_id,
    'status', CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_german_payment_proof(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_german_payment_proof(uuid,boolean,text) TO authenticated;
