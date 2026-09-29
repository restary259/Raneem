-- Complete the post-enrollment student Visa workflow.
-- Keeps Visa outside cases.status, preserves admin-controlled Visa outcomes,
-- and gives students only the narrowly-scoped mutations they need to prepare
-- and submit their own file.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Student Visa application: read-only rows; mutations go through
--    SECURITY DEFINER RPCs that enforce enrollment + ownership.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage own visa" ON public.visa_applications;
DROP POLICY IF EXISTS "Students read own visa" ON public.visa_applications;

CREATE POLICY "Students read own visa"
ON public.visa_applications
FOR SELECT TO authenticated
USING (student_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Student dynamic Visa values: students may edit their own configured
--    questions, but the canonical visa_status field remains Admin-controlled.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students insert own visa values" ON public.visa_field_values;
DROP POLICY IF EXISTS "Students update own visa values" ON public.visa_field_values;

CREATE POLICY "Students insert own non-status visa values"
ON public.visa_field_values
FOR INSERT TO authenticated
WITH CHECK (
  student_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.visa_fields vf
    WHERE vf.id = visa_field_values.field_id
      AND vf.field_key <> 'visa_status'
  )
);

CREATE POLICY "Students update own non-status visa values"
ON public.visa_field_values
FOR UPDATE TO authenticated
USING (
  student_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.visa_fields vf
    WHERE vf.id = visa_field_values.field_id
      AND vf.field_key <> 'visa_status'
  )
)
WITH CHECK (
  student_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.visa_fields vf
    WHERE vf.id = visa_field_values.field_id
      AND vf.field_key <> 'visa_status'
  )
);

GRANT SELECT, INSERT, UPDATE ON public.visa_field_values TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Student document selection: link existing documents only. Never copy or
--    delete the underlying documents row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students read own visa application documents"
  ON public.visa_application_documents;
DROP POLICY IF EXISTS "Students add own visa application documents"
  ON public.visa_application_documents;
DROP POLICY IF EXISTS "Students remove own visa application documents"
  ON public.visa_application_documents;

CREATE POLICY "Students read own visa application documents"
ON public.visa_application_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.visa_applications va
    JOIN public.documents d ON d.id = visa_application_documents.document_id
    WHERE va.id = visa_application_documents.visa_application_id
      AND va.student_user_id = auth.uid()
      AND d.student_id = auth.uid()
  )
);

CREATE POLICY "Students add own visa application documents"
ON public.visa_application_documents
FOR INSERT TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.visa_applications va
    JOIN public.documents d ON d.id = visa_application_documents.document_id
    JOIN public.cases c ON c.id = va.case_id
    WHERE va.id = visa_application_documents.visa_application_id
      AND va.student_user_id = auth.uid()
      AND d.student_id = auth.uid()
      AND c.status = 'enrollment_paid'
  )
);

CREATE POLICY "Students remove own visa application documents"
ON public.visa_application_documents
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.visa_applications va
    JOIN public.documents d ON d.id = visa_application_documents.document_id
    WHERE va.id = visa_application_documents.visa_application_id
      AND va.student_user_id = auth.uid()
      AND d.student_id = auth.uid()
  )
);

GRANT SELECT, INSERT, DELETE ON public.visa_application_documents TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Secure student-side lazy application creation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_student_visa_application(p_case_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_application uuid;
  v_created boolean := false;
BEGIN
  SELECT c.student_user_id
    INTO v_student
  FROM public.cases c
  WHERE c.id = p_case_id
    AND c.status = 'enrollment_paid'
    AND c.deleted_at IS NULL
    AND c.archived = false;

  IF v_student IS NULL OR v_student <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: enrolled student case required';
  END IF;

  SELECT va.id
    INTO v_application
  FROM public.visa_applications va
  WHERE va.case_id = p_case_id
  LIMIT 1;

  IF v_application IS NULL THEN
    INSERT INTO public.visa_applications (
      case_id,
      student_user_id,
      visa_outcome
    )
    VALUES (
      p_case_id,
      v_student,
      'pending'
    )
    ON CONFLICT (case_id) DO NOTHING
    RETURNING id INTO v_application;

    IF v_application IS NULL THEN
      SELECT va.id
        INTO v_application
      FROM public.visa_applications va
      WHERE va.case_id = p_case_id
      LIMIT 1;
    ELSE
      v_created := true;
    END IF;
  END IF;

  IF v_created THEN
    PERFORM public.log_case_event(
      p_case_id,
      'visa_file_started',
      jsonb_build_object(
        'student_user_id', v_student,
        'started_at', now()
      ),
      true
    );
  END IF;

  RETURN v_application;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_student_visa_application(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_student_visa_application(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Student arrival confirmation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_student_visa_arrived(p_case_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_application uuid;
  v_arrived_at timestamptz := now();
BEGIN
  SELECT c.student_user_id
    INTO v_student
  FROM public.cases c
  WHERE c.id = p_case_id
    AND c.status = 'enrollment_paid'
    AND c.deleted_at IS NULL
    AND c.archived = false;

  IF v_student IS NULL OR v_student <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: enrolled student case required';
  END IF;

  v_application := public.ensure_student_visa_application(p_case_id);

  UPDATE public.visa_applications
  SET arrived_in_germany_at = COALESCE(arrived_in_germany_at, v_arrived_at),
      updated_at = now()
  WHERE id = v_application
  RETURNING arrived_in_germany_at INTO v_arrived_at;

  PERFORM public.log_case_event(
    p_case_id,
    'student_arrived_in_germany',
    jsonb_build_object('arrived_at', v_arrived_at),
    true
  );

  RETURN v_arrived_at;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_student_visa_arrived(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_student_visa_arrived(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Student submission: server-side validation + canonical status write.
--    No legal requirements are invented; only active, required configured
--    Visa fields must be answered. Actual arrival is the operational
--    post-arrival gate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_student_visa_application(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid;
  v_application public.visa_applications%ROWTYPE;
  v_status_field uuid;
  v_missing text[];
  v_snapshot jsonb;
  v_submitted_at timestamptz;
  v_selected_documents jsonb;
  v_field_values jsonb;
  v_profile jsonb;
BEGIN
  SELECT c.student_user_id
    INTO v_student
  FROM public.cases c
  WHERE c.id = p_case_id
    AND c.status = 'enrollment_paid'
    AND c.deleted_at IS NULL
    AND c.archived = false;

  IF v_student IS NULL OR v_student <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied: enrolled student case required';
  END IF;

  SELECT va.*
    INTO v_application
  FROM public.visa_applications va
  WHERE va.case_id = p_case_id
    AND va.student_user_id = v_student
  LIMIT 1;

  IF v_application.id IS NULL THEN
    RAISE EXCEPTION 'Visa application has not been started';
  END IF;

  IF v_application.visa_applied_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'status', 'applied',
      'submitted_at', v_application.visa_applied_at,
      'already_submitted', true
    );
  END IF;

  IF v_application.arrived_in_germany_at IS NULL THEN
    RAISE EXCEPTION 'Confirm your arrival in Germany before submitting the Visa file';
  END IF;

  SELECT array_agg(vf.field_key ORDER BY vf.display_order, vf.created_at)
    INTO v_missing
  FROM public.visa_fields vf
  LEFT JOIN public.visa_field_values vfv
    ON vfv.field_id = vf.id
   AND vfv.student_user_id = v_student
  WHERE vf.is_active = true
    AND vf.is_required = true
    AND vf.field_key <> 'visa_status'
    AND NULLIF(BTRIM(COALESCE(vfv.value, '')), '') IS NULL;

  IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Missing required Visa information: %', array_to_string(v_missing, ', ');
  END IF;

  SELECT COALESCE(jsonb_object_agg(vf.field_key, COALESCE(vfv.value, '')), '{}'::jsonb)
    INTO v_field_values
  FROM public.visa_fields vf
  LEFT JOIN public.visa_field_values vfv
    ON vfv.field_id = vf.id
   AND vfv.student_user_id = v_student
  WHERE vf.is_active = true;

  -- Required proof documents are driven only by active, required boolean
  -- Visa fields whose existing field_key maps to a proof category. A true
  -- field value also satisfies the proof, matching computeVisaReadiness().
  IF EXISTS (
    SELECT 1
    FROM public.visa_fields vf
    LEFT JOIN public.visa_field_values vfv
      ON vfv.field_id = vf.id
     AND vfv.student_user_id = v_student
    WHERE vf.is_active = true
      AND vf.is_required = true
      AND vf.field_type = 'boolean'
      AND vf.field_key IN ('bank_statement', 'health_insurance', 'accommodation_proof')
      AND COALESCE(vfv.value, '') <> 'true'
      AND NOT EXISTS (
        SELECT 1
        FROM public.visa_application_documents vad
        JOIN public.documents d ON d.id = vad.document_id
        WHERE vad.visa_application_id = v_application.id
          AND d.student_id = v_student
          AND d.deleted_at IS NULL
          AND d.category =
            CASE vf.field_key
              WHEN 'bank_statement' THEN 'financial'
              WHEN 'health_insurance' THEN 'insurance'
              WHEN 'accommodation_proof' THEN 'housing'
            END
      )
  ) THEN
    RAISE EXCEPTION 'Missing required Visa documents';
  END IF;

  SELECT COALESCE(
    jsonb_agg(vad.document_id ORDER BY vad.created_at),
    '[]'::jsonb
  )
    INTO v_selected_documents
  FROM public.visa_application_documents vad
  WHERE vad.visa_application_id = v_application.id;

  SELECT to_jsonb(p)
    INTO v_profile
  FROM (
    SELECT
      p.full_name,
      p.email,
      p.phone_number,
      p.university_name,
      p.arrival_date,
      p.eye_color,
      p.passport_expiry,
      p.nationality,
      p.has_changed_legal_name,
      p.previous_legal_name,
      p.has_criminal_record,
      p.criminal_record_details,
      p.has_dual_citizenship,
      p.second_passport_country
    FROM public.profiles p
    WHERE p.id = v_student
  ) p;

  v_submitted_at := COALESCE(v_application.visa_applied_at, now());

  v_snapshot := jsonb_build_object(
    'captured_at', v_submitted_at,
    'captured_by', auth.uid(),
    'fields', COALESCE(v_field_values, '{}'::jsonb),
    'profile', COALESCE(v_profile, '{}'::jsonb),
    'documents', COALESCE(v_selected_documents, '[]'::jsonb)
  );

  UPDATE public.visa_applications
  SET visa_applied_at = v_submitted_at,
      visa_outcome = 'pending',
      submission_snapshot = v_snapshot,
      updated_at = now()
  WHERE id = v_application.id;

  SELECT vf.id
    INTO v_status_field
  FROM public.visa_fields vf
  WHERE vf.field_key = 'visa_status'
    AND vf.is_active = true
  ORDER BY vf.display_order, vf.created_at
  LIMIT 1;

  IF v_status_field IS NOT NULL THEN
    INSERT INTO public.visa_field_values (
      field_id,
      student_user_id,
      value,
      updated_at
    )
    VALUES (
      v_status_field,
      v_student,
      'applied',
      now()
    )
    ON CONFLICT (student_user_id, field_id)
    DO UPDATE SET
      value = 'applied',
      updated_at = now();
  END IF;

  PERFORM public.log_case_event(
    p_case_id,
    'visa_application_submitted',
    jsonb_build_object(
      'submitted_at', v_submitted_at,
      'student_user_id', v_student,
      'selected_document_count',
      (SELECT count(*) FROM public.visa_application_documents WHERE visa_application_id = v_application.id)
    ),
    false
  );

  -- Explicit confirmation because notify_case_event predates these Visa
  -- event types. Dedupe prevents double-notification on retries.
  IF v_student IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_student,
      NULL,
      'case_event',
      'Visa file submitted for Administration',
      'تم تقديم ملف التأشيرة للإدارة',
      'Your Visa file was submitted to Administration.',
      'تم تقديم ملف التأشيرة إلى الإدارة.',
      p_case_id,
      '/student/visa',
      'visa-submitted:student:' || v_student::text || ':' || p_case_id::text
    );
  END IF;

  PERFORM public.emit_notification(
    admin_user.user_id,
    auth.uid(),
    'case_event',
    'Visa file submitted',
    'تم تقديم ملف التأشيرة',
    'A student submitted a Visa file for Administration — case ' || COALESCE((SELECT case_reference FROM public.cases WHERE id = p_case_id), left(p_case_id::text, 8)),
    'تم تقديم ملف تأشيرة للإدارة — الملف ' || COALESCE((SELECT case_reference FROM public.cases WHERE id = p_case_id), left(p_case_id::text, 8)),
    p_case_id,
    '/admin/pipeline?tab=visa',
    'visa-submitted:admin:' || admin_user.user_id::text || ':' || p_case_id::text
  )
  FROM public.user_roles admin_user
  WHERE admin_user.role = 'admin';

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'submitted_at', v_submitted_at,
    'selected_document_count',
      (SELECT count(*) FROM public.visa_application_documents WHERE visa_application_id = v_application.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_student_visa_application(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_student_visa_application(uuid)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Correct the Admin queue semantics:
--    exactly the enrolled population, with application submission timestamp
--    only when it really exists. The UI handles the two queue sections.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_visa_queue()
RETURNS TABLE (
  case_id                 uuid,
  case_reference          text,
  student_user_id         uuid,
  full_name               text,
  phone                   text,
  email                   text,
  assigned_to             uuid,
  assigned_name           text,
  enrolled_at             timestamptz,
  planned_arrival         date,
  actual_arrival          timestamptz,
  visa_status             text,
  visa_applied_at         timestamptz,
  visa_application_id     uuid,
  document_count          integer,
  selected_document_count integer,
  created_at              timestamptz,
  updated_at              timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_reference,
    c.student_user_id,
    COALESCE(p.full_name, c.full_name),
    COALESCE(p.phone_number, c.phone_number),
    p.email,
    c.assigned_to,
    COALESCE(ap.full_name, ap.email),
    cs.enrollment_paid_at,
    p.arrival_date,
    va.arrived_in_germany_at,
    COALESCE(
      (
        SELECT vfv.value
        FROM public.visa_fields vf
        JOIN public.visa_field_values vfv ON vfv.field_id = vf.id
        WHERE vf.field_key = 'visa_status'
          AND vfv.student_user_id = c.student_user_id
        ORDER BY vf.display_order, vf.created_at
        LIMIT 1
      ),
      CASE WHEN va.visa_applied_at IS NOT NULL THEN 'applied' ELSE 'not_applied' END
    ),
    va.visa_applied_at,
    va.id,
    COALESCE(dc.document_count, 0)::integer,
    COALESCE(sdc.selected_count, 0)::integer,
    c.created_at,
    COALESCE(va.updated_at, c.updated_at)
  FROM public.cases c
  LEFT JOIN public.profiles p ON p.id = c.student_user_id
  LEFT JOIN public.profiles ap ON ap.id = c.assigned_to
  LEFT JOIN public.case_submissions cs ON cs.case_id = c.id
  LEFT JOIN public.visa_applications va ON va.case_id = c.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS document_count
    FROM public.documents d
    WHERE d.student_id = c.student_user_id
      AND d.deleted_at IS NULL
  ) dc ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS selected_count
    FROM public.visa_application_documents vad
    WHERE vad.visa_application_id = va.id
  ) sdc ON true
  WHERE c.status = 'enrollment_paid'
    AND c.deleted_at IS NULL
    AND c.archived = false
    AND c.student_user_id IS NOT NULL
  ORDER BY
    CASE WHEN va.visa_applied_at IS NOT NULL THEN 1 ELSE 0 END,
    va.visa_applied_at DESC NULLS LAST,
    c.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_visa_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_visa_queue() TO authenticated;

COMMIT;
