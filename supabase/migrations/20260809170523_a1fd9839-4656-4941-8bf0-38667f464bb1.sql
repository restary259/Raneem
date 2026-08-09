-- 1. Catalog configuration -------------------------------------------------
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS',
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS default_quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allows_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commissionable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accommodation_id uuid REFERENCES public.accommodations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE public.service_catalog
    ADD CONSTRAINT service_catalog_pricing_model_chk
    CHECK (pricing_model IN ('fixed','per_week','per_month','per_person','quantity'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bump the version whenever the authoritative price or currency changes so a
-- case line can always be traced back to the configuration it was priced from.
CREATE OR REPLACE FUNCTION public.bump_service_catalog_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.default_price IS DISTINCT FROM OLD.default_price
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.pricing_model IS DISTINCT FROM OLD.pricing_model THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_service_catalog_version ON public.service_catalog;
CREATE TRIGGER trg_service_catalog_version
BEFORE UPDATE ON public.service_catalog
FOR EACH ROW EXECUTE FUNCTION public.bump_service_catalog_version();

-- 2. Frozen snapshot columns on case lines ----------------------------------
ALTER TABLE public.case_services
  ADD COLUMN IF NOT EXISTS pricing_model text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS unit_label text,
  ADD COLUMN IF NOT EXISTS catalog_version integer,
  ADD COLUMN IF NOT EXISTS commissionable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz NOT NULL DEFAULT now();

UPDATE public.case_services SET currency = COALESCE(currency, 'ILS');
ALTER TABLE public.case_services ALTER COLUMN currency SET DEFAULT 'ILS';
ALTER TABLE public.case_services ALTER COLUMN currency SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS case_services_unique_catalog_line
  ON public.case_services (case_id, service_id) WHERE service_id IS NOT NULL;

-- 3. Admin-configurable course duration -------------------------------------
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_course_weeks integer NOT NULL DEFAULT 40;

-- 4. Only the controlled RPCs may write case service lines -------------------
CREATE OR REPLACE FUNCTION public.guard_case_services_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('darb.pricing_engine', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Service lines can only be changed through the pricing engine';
END $$;

DROP TRIGGER IF EXISTS trg_guard_case_services_write ON public.case_services;
CREATE TRIGGER trg_guard_case_services_write
BEFORE INSERT OR UPDATE OR DELETE ON public.case_services
FOR EACH ROW EXECUTE FUNCTION public.guard_case_services_write();

-- 5. Authoritative selection RPC --------------------------------------------
DROP FUNCTION IF EXISTS public.set_case_services(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.set_case_services(p_case_id uuid, p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_sub RECORD;
  v_item jsonb;
  v_sc RECORD;
  v_qty numeric;
  v_ids uuid[] := '{}'::uuid[];
  v_before numeric := 0;
  v_after numeric := 0;
  v_added text[] := '{}';
  v_removed text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT id, assigned_to, status, case_reference INTO v_case FROM public.cases WHERE id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Case not found'; END IF;

  IF NOT (public.has_role(v_uid, 'admin') OR v_case.assigned_to = v_uid) THEN
    RAISE EXCEPTION 'Not allowed to manage services for this case';
  END IF;

  -- After the case has been submitted only an admin may still change services.
  IF NOT public.has_role(v_uid, 'admin')
     AND v_case.status IN ('submitted','payment_confirmed','enrollment_paid','enrolled') THEN
    RAISE EXCEPTION 'Services are locked once the case has been submitted';
  END IF;

  SELECT school_id, program_id, accommodation_id INTO v_sub
    FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_before
    FROM public.case_services WHERE case_id = p_case_id;

  PERFORM set_config('darb.pricing_engine', 'on', true);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    SELECT * INTO v_sc FROM public.service_catalog WHERE id = (v_item->>'service_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Unknown service';
    END IF;
    IF NOT v_sc.is_active THEN
      RAISE EXCEPTION 'Service "%" is not active', v_sc.name_en;
    END IF;
    IF v_sc.school_id IS NOT NULL AND v_sc.school_id IS DISTINCT FROM v_sub.school_id THEN
      RAISE EXCEPTION 'Service "%" is not available for the selected school', v_sc.name_en;
    END IF;
    IF v_sc.program_id IS NOT NULL AND v_sc.program_id IS DISTINCT FROM v_sub.program_id THEN
      RAISE EXCEPTION 'Service "%" is not available for the selected course', v_sc.name_en;
    END IF;
    IF v_sc.accommodation_id IS NOT NULL AND v_sc.accommodation_id IS DISTINCT FROM v_sub.accommodation_id THEN
      RAISE EXCEPTION 'Service "%" is not available for the selected accommodation', v_sc.name_en;
    END IF;

    v_qty := COALESCE(NULLIF((v_item->>'quantity'), '')::numeric, v_sc.default_quantity, 1);
    IF NOT v_sc.allows_quantity THEN
      v_qty := COALESCE(v_sc.default_quantity, 1);
    END IF;
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;

    v_ids := array_append(v_ids, v_sc.id);

    IF EXISTS (SELECT 1 FROM public.case_services WHERE case_id = p_case_id AND service_id = v_sc.id) THEN
      -- Keep the frozen price; only the quantity may move.
      UPDATE public.case_services
         SET quantity = v_qty, updated_at = now()
       WHERE case_id = p_case_id AND service_id = v_sc.id;
    ELSE
      INSERT INTO public.case_services (
        case_id, service_id, description, category, unit_price, quantity, discount,
        currency, pricing_model, unit_label, catalog_version, commissionable, added_by
      ) VALUES (
        p_case_id, v_sc.id, v_sc.name_en, v_sc.category, COALESCE(v_sc.default_price, 0), v_qty, 0,
        COALESCE(v_sc.currency, 'ILS'), v_sc.pricing_model, v_sc.pricing_model, v_sc.version,
        v_sc.commissionable, v_uid
      );
      v_added := array_append(v_added, v_sc.name_en);
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(description), '{}') INTO v_removed
    FROM public.case_services
   WHERE case_id = p_case_id AND service_id IS NOT NULL AND NOT (service_id = ANY (v_ids));

  DELETE FROM public.case_services
   WHERE case_id = p_case_id AND service_id IS NOT NULL AND NOT (service_id = ANY (v_ids));

  -- Legacy hand-typed lines are no longer part of the model.
  DELETE FROM public.case_services WHERE case_id = p_case_id AND service_id IS NULL;

  PERFORM set_config('darb.pricing_engine', 'off', true);

  SELECT COALESCE(SUM(unit_price * quantity - discount), 0) INTO v_after
    FROM public.case_services WHERE case_id = p_case_id;

  IF v_before IS DISTINCT FROM v_after OR array_length(v_added,1) IS NOT NULL OR array_length(v_removed,1) IS NOT NULL THEN
    PERFORM public.log_case_event(
      p_case_id, 'services_changed',
      jsonb_build_object('added', to_jsonb(v_added), 'removed', to_jsonb(v_removed),
                         'old_total', round(v_before,2), 'new_total', round(v_after,2),
                         'actor', v_uid),
      true
    );
  END IF;

  RETURN jsonb_build_object('total', round(v_after, 2));
END $$;

GRANT EXECUTE ON FUNCTION public.set_case_services(uuid, jsonb) TO authenticated;

-- 6. Admin-only correction of a single line ---------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_case_service(
  p_case_service_id uuid, p_unit_price numeric, p_quantity numeric, p_discount numeric, p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.case_services%ROWTYPE;
BEGIN
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Only an administrator may adjust a service line';
  END IF;
  SELECT * INTO v_row FROM public.case_services WHERE id = p_case_service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service line not found'; END IF;

  PERFORM set_config('darb.pricing_engine', 'on', true);
  UPDATE public.case_services
     SET unit_price = COALESCE(p_unit_price, unit_price),
         quantity   = COALESCE(p_quantity, quantity),
         discount   = COALESCE(p_discount, discount),
         updated_at = now()
   WHERE id = p_case_service_id;
  PERFORM set_config('darb.pricing_engine', 'off', true);

  PERFORM public.log_case_event(
    v_row.case_id, 'service_adjusted',
    jsonb_build_object(
      'service', v_row.description, 'reason', p_reason, 'actor', v_uid,
      'old', jsonb_build_object('unit_price', v_row.unit_price, 'quantity', v_row.quantity, 'discount', v_row.discount),
      'new', jsonb_build_object('unit_price', COALESCE(p_unit_price, v_row.unit_price),
                                'quantity', COALESCE(p_quantity, v_row.quantity),
                                'discount', COALESCE(p_discount, v_row.discount))
    ), true
  );
  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_case_service(uuid, numeric, numeric, numeric, text) TO authenticated;

-- 7. Financial summary carries the pricing detail ----------------------------
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
  v_services jsonb := '[]'::jsonb;
  v_service_total numeric := 0;
  v_commissionable numeric := 0;
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

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR v_case.assigned_to = v_uid
    OR v_case.student_user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to read financials for this case';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'description'), '[]'::jsonb),
         COALESCE(SUM((x->>'line_total')::numeric), 0),
         COALESCE(SUM((x->>'line_total')::numeric) FILTER (WHERE (x->>'commissionable')::boolean), 0)
    INTO v_services, v_service_total, v_commissionable
  FROM (
    SELECT jsonb_build_object(
      'id', cs.id,
      'service_id', cs.service_id,
      'description', cs.description,
      'category', cs.category,
      'pricing_model', cs.pricing_model,
      'commissionable', cs.commissionable,
      'catalog_version', cs.catalog_version,
      'quantity', cs.quantity,
      'unit_price', round(cs.unit_price, 2),
      'discount', round(cs.discount, 2),
      'currency', cs.currency,
      'line_total', round(cs.unit_price * cs.quantity - cs.discount, 2)
    ) AS x
    FROM public.case_services cs WHERE cs.case_id = p_case_id
  ) s;

  SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0),
         COALESCE(SUM(amount) FILTER (WHERE status = 'submitted'), 0)
    INTO v_confirmed, v_submitted
  FROM public.case_payments WHERE case_id = p_case_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', p.id, 'amount', round(p.amount, 2), 'currency', p.currency,
           'payment_type', p.payment_type, 'status', p.status, 'note', p.note,
           'submitted_by', p.submitted_by, 'submitted_at', p.submitted_at,
           'confirmed_by', p.confirmed_by, 'confirmed_at', p.confirmed_at,
           'rejected_reason', p.rejected_reason, 'created_at', p.created_at
         ) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_payments
  FROM public.case_payments p WHERE p.case_id = p_case_id;

  SELECT * INTO v_sub FROM public.case_submissions
   WHERE case_id = p_case_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_sub.program_id IS NOT NULL THEN
      SELECT name_ar, name_en, currency INTO v_prog FROM public.programs WHERE id = v_sub.program_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'program',
        'name_ar', v_prog.name_ar, 'name_en', v_prog.name_en,
        'weekly_price', round(COALESCE(v_sub.program_weekly_price, 0), 2),
        'weeks', COALESCE(v_sub.program_weeks, 0),
        'total', round(COALESCE(v_sub.program_price, COALESCE(v_sub.program_weekly_price,0) * COALESCE(v_sub.program_weeks,0)), 2),
        'currency', COALESCE(v_prog.currency, 'EUR'),
        'estimate', true
      );
    END IF;
    IF v_sub.accommodation_id IS NOT NULL THEN
      SELECT name_ar, name_en, currency INTO v_acc FROM public.accommodations WHERE id = v_sub.accommodation_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'accommodation',
        'name_ar', v_acc.name_ar, 'name_en', v_acc.name_en,
        'weekly_price', round(COALESCE(v_sub.accommodation_weekly_price, 0), 2),
        'weeks', COALESCE(v_sub.accommodation_weeks, 0),
        'total', round(COALESCE(v_sub.accommodation_price, COALESCE(v_sub.accommodation_weekly_price,0) * COALESCE(v_sub.accommodation_weeks,0)), 2),
        'currency', COALESCE(v_acc.currency, 'EUR'),
        'estimate', true
      );
    END IF;
    IF v_sub.insurance_id IS NOT NULL THEN
      SELECT name, currency INTO v_ins FROM public.insurances WHERE id = v_sub.insurance_id;
      v_school := v_school || jsonb_build_object(
        'kind', 'insurance',
        'name_ar', v_ins.name, 'name_en', v_ins.name,
        'weekly_price', NULL, 'weeks', NULL,
        'total', round(COALESCE(v_sub.insurance_price, 0), 2),
        'currency', COALESCE(v_ins.currency, 'EUR'),
        'estimate', true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'case_id', v_case.id,
    'case_reference', v_case.case_reference,
    'student_name', v_case.full_name,
    'status', v_case.status,
    'school_id', v_sub.school_id,
    'currency', 'ILS',
    'services', v_services,
    'service_total', round(v_service_total, 2),
    'commissionable_total', round(v_commissionable, 2),
    'school_costs', v_school,
    'payments', v_payments,
    'total_confirmed', round(v_confirmed, 2),
    'total_pending_review', round(v_submitted, 2),
    'remaining', round(GREATEST(v_service_total - v_confirmed, 0), 2)
  );
END;
$function$;