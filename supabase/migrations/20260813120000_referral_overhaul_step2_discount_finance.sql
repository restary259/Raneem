-- ════════════════════════════════════════════════════════════════════════
-- Referral overhaul — STEP 2 (make the referral discount REAL money)
--
-- The edge function (create-case-from-apply) writes cases.referral_discount
-- (guarded column: only service_role / admins may write it). Previously the
-- discount was cosmetic — no RPC ever read it. This migration subtracts the
-- referral discount from the authoritative DARB service total so the
-- discounted amount flows through payments, the invoice snapshot and the
-- KPI / remaining totals exactly once.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Authoritative DARB (ILS) service total — subtract the referral discount.
CREATE OR REPLACE FUNCTION public.get_case_darb_service_total(p_case_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
  v_case RECORD;
  v_total numeric := 0;
  v_discount numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, assigned_to, student_user_id, referral_discount
  INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid OR v_case.student_user_id = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to read financials for this case';
  END IF;
  SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_total
    FROM public.case_services WHERE case_id = p_case_id;
  v_discount := COALESCE(v_case.referral_discount, 0);
  RETURN round(GREATEST(v_total - v_discount, 0), 2);
END;
$$;

-- 2) Financial summary — same subtraction, plus the discount exposed for the UI.
CREATE OR REPLACE FUNCTION public.get_case_financials(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_has_sub boolean := false;
  v_services jsonb := '[]'::jsonb;
  v_service_total numeric := 0;
  v_referral_discount numeric := 0;
  v_confirmed numeric := 0;
  v_submitted numeric := 0;
  v_payments jsonb := '[]'::jsonb;
  v_school jsonb := '[]'::jsonb;
  v_prog RECORD;
  v_acc RECORD;
  v_ins RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, assigned_to, student_user_id, status, referral_discount
  INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;
  v_referral_discount := COALESCE(v_case.referral_discount, 0);

  IF NOT (public.has_role(v_uid,'admin') OR v_case.assigned_to=v_uid OR v_case.student_user_id=v_uid) THEN
    RAISE EXCEPTION 'Not allowed to read financials for this case';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'description'),'[]'::jsonb),
         COALESCE(SUM((x->>'line_total')::numeric),0)
  INTO v_services, v_service_total
  FROM (
    SELECT jsonb_build_object(
      'id',cs.id,'service_id',cs.service_id,'description',cs.description,'category',cs.category,
      'pricing_model',cs.pricing_model,'commissionable',cs.commissionable,'catalog_version',cs.catalog_version,
      'quantity',cs.quantity,'unit_price',round(cs.unit_price,2),'discount',round(cs.discount,2),
      'currency',cs.currency,'line_total',round(cs.unit_price*cs.quantity-cs.discount,2)
    ) x
    FROM public.case_services cs WHERE cs.case_id=p_case_id
  ) s;

  v_service_total := GREATEST(v_service_total - v_referral_discount, 0);

  SELECT COALESCE(SUM(amount) FILTER (WHERE status='confirmed' AND payment_type='agency_service' AND currency='ILS'),0),
         COALESCE(SUM(amount) FILTER (WHERE status='submitted' AND payment_type='agency_service' AND currency='ILS'),0)
  INTO v_confirmed, v_submitted
  FROM public.case_payments WHERE case_id=p_case_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',p.id,'amount',round(p.amount,2),'currency',p.currency,'payment_type',p.payment_type,'status',p.status,
    'note',p.note,'submitted_by',p.submitted_by,'submitted_at',p.submitted_at,'confirmed_by',p.confirmed_by,
    'confirmed_at',p.confirmed_at,'rejected_reason',p.rejected_reason,'created_at',p.created_at
  ) ORDER BY p.created_at DESC),'[]'::jsonb)
  INTO v_payments
  FROM public.case_payments p WHERE p.case_id=p_case_id;

  SELECT * INTO v_sub FROM public.case_submissions
  WHERE case_id=p_case_id AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;
  v_has_sub := FOUND;

  IF v_has_sub THEN
    IF v_sub.program_id IS NOT NULL THEN
      SELECT name_ar,name_en,currency INTO v_prog FROM public.programs WHERE id=v_sub.program_id;
      v_school := v_school || jsonb_build_object(
        'kind','program','name_ar',v_prog.name_ar,'name_en',v_prog.name_en,
        'weekly_price',round(COALESCE(v_sub.program_weekly_price,0),2),'weeks',COALESCE(v_sub.program_weeks,0),
        'total',round(COALESCE(v_sub.program_price,COALESCE(v_sub.program_weekly_price,0)*COALESCE(v_sub.program_weeks,0)),2),
        'currency',COALESCE(v_prog.currency,'EUR'),'estimate',true
      );
    END IF;
    IF v_sub.accommodation_id IS NOT NULL THEN
      SELECT name_ar,name_en,currency INTO v_acc FROM public.accommodations WHERE id=v_sub.accommodation_id;
      v_school := v_school || jsonb_build_object(
        'kind','accommodation','name_ar',v_acc.name_ar,'name_en',v_acc.name_en,
        'weekly_price',round(COALESCE(v_sub.accommodation_weekly_price,0),2),'weeks',COALESCE(v_sub.accommodation_weeks,0),
        'total',round(COALESCE(v_sub.accommodation_price,COALESCE(v_sub.accommodation_weekly_price,0)*COALESCE(v_sub.accommodation_weeks,0)),2),
        'currency',COALESCE(v_acc.currency,'EUR'),'estimate',true
      );
    END IF;
    IF v_sub.insurance_id IS NOT NULL THEN
      SELECT name,currency INTO v_ins FROM public.insurances WHERE id=v_sub.insurance_id;
      v_school := v_school || jsonb_build_object(
        'kind','insurance','name_ar',v_ins.name,'name_en',v_ins.name,'weekly_price',NULL,'weeks',NULL,
        'total',round(COALESCE(v_sub.insurance_price,0),2),'currency',COALESCE(v_ins.currency,'EUR'),'estimate',true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'case_id',v_case.id,'case_reference',v_case.case_reference,'student_name',v_case.full_name,'status',v_case.status,
    'currency','ILS','services',v_services,'service_total',round(v_service_total,2),'referral_discount',round(v_referral_discount,2),'school_costs',v_school,
    'payments',v_payments,'total_confirmed',round(v_confirmed,2),'total_pending_review',round(v_submitted,2),
    'remaining',round(GREATEST(v_service_total-v_confirmed,0),2),
    'school_id', CASE WHEN v_has_sub THEN v_sub.school_id ELSE NULL END,
    'program_id', CASE WHEN v_has_sub THEN v_sub.program_id ELSE NULL END,
    'accommodation_id', CASE WHEN v_has_sub THEN v_sub.accommodation_id ELSE NULL END,
    'insurance_id', CASE WHEN v_has_sub THEN v_sub.insurance_id ELSE NULL END,
    'profile_completed_at', CASE WHEN v_has_sub THEN v_sub.profile_completed_at ELSE NULL END
  );
END;
$function$;
