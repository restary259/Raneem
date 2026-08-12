-- Keep the school filled in automatically on every student-file save.
CREATE OR REPLACE FUNCTION public.sync_submission_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.program_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.programs WHERE id = NEW.program_id;
  END IF;
  IF NEW.school_id IS NULL AND NEW.accommodation_id IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.accommodations WHERE id = NEW.accommodation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submission_school_id ON public.case_submissions;
CREATE TRIGGER trg_sync_submission_school_id
BEFORE INSERT OR UPDATE ON public.case_submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_submission_school_id();

UPDATE public.case_submissions s
   SET school_id = p.school_id
  FROM public.programs p
 WHERE s.school_id IS NULL AND s.program_id = p.id AND p.school_id IS NOT NULL;

UPDATE public.case_submissions s
   SET school_id = a.school_id
  FROM public.accommodations a
 WHERE s.school_id IS NULL AND s.accommodation_id = a.id AND a.school_id IS NOT NULL;

-- Report the chosen school/course/accommodation/insurance in the financial summary.
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
  v_confirmed numeric := 0;
  v_submitted numeric := 0;
  v_payments jsonb := '[]'::jsonb;
  v_school jsonb := '[]'::jsonb;
  v_prog RECORD;
  v_acc RECORD;
  v_ins RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, case_reference, full_name, assigned_to, student_user_id, status
  INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

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
    'currency','ILS','services',v_services,'service_total',round(v_service_total,2),'school_costs',v_school,
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

DROP POLICY IF EXISTS "Team can read finance confirmations for assigned cases" ON public.case_finance_confirmations;

DROP POLICY IF EXISTS "Admins manage master services" ON public.master_services;
CREATE POLICY "Admins manage master services"
ON public.master_services FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));