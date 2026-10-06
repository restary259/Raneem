-- MANUAL DEPLOY. Additive only: no data is changed or deleted.
-- Student "Visa Information" wizard: answers live on the case's
-- visa_applications row; students write only through RPCs.

ALTER TABLE public.visa_applications
  ADD COLUMN IF NOT EXISTS info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS info_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS info_last_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS info_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS info_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS info_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS info_checked_by uuid,
  ADD COLUMN IF NOT EXISTS info_correction_note text;

DO $$ BEGIN
  ALTER TABLE public.visa_applications
    ADD CONSTRAINT visa_applications_info_status_chk
    CHECK (info_status IN ('draft','in_progress','submitted','needs_correction','checked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Student saves one section (autosave).
CREATE OR REPLACE FUNCTION public.save_my_visa_info(
  p_case_id uuid, p_section text, p_payload jsonb, p_last_step int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_section NOT IN ('personal','family','contact','passport','travel','previous','background','financing','review') THEN
    RAISE EXCEPTION 'INVALID_SECTION';
  END IF;
  IF jsonb_typeof(p_payload) <> 'object' OR length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id
                 AND c.student_user_id = v_uid AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  SELECT info_status INTO v_status FROM public.visa_applications WHERE case_id = p_case_id;
  IF v_status IN ('submitted','checked') THEN RAISE EXCEPTION 'VISA_INFO_LOCKED'; END IF;

  INSERT INTO public.visa_applications (case_id, student_user_id, info, info_status, info_last_step, info_updated_at)
  VALUES (p_case_id, v_uid, jsonb_build_object(p_section, p_payload), 'in_progress', greatest(0, least(p_last_step, 8)), now())
  ON CONFLICT (case_id) DO UPDATE
    SET info = public.visa_applications.info || jsonb_build_object(p_section, p_payload),
        info_status = CASE WHEN public.visa_applications.info_status = 'needs_correction'
                           THEN 'needs_correction' ELSE 'in_progress' END,
        info_last_step = greatest(0, least(p_last_step, 8)),
        info_updated_at = now(),
        updated_at = now();
END $$;

-- Student submits; required sections are checked server-side.
CREATE OR REPLACE FUNCTION public.submit_my_visa_info(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_info jsonb; v_status text; s text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT va.info, va.info_status INTO v_info, v_status
    FROM public.visa_applications va JOIN public.cases c ON c.id = va.case_id
   WHERE va.case_id = p_case_id AND c.student_user_id = v_uid AND c.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF v_status IN ('submitted','checked') THEN RETURN; END IF; -- idempotent
  FOREACH s IN ARRAY ARRAY['personal','contact','passport','travel','previous','background','financing'] LOOP
    IF coalesce(v_info -> s, '{}'::jsonb) = '{}'::jsonb THEN
      RAISE EXCEPTION 'VISA_INFO_INCOMPLETE:%', s;
    END IF;
  END LOOP;
  IF coalesce((v_info -> 'review' ->> 'confirmed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'VISA_INFO_NOT_CONFIRMED';
  END IF;
  UPDATE public.visa_applications
     SET info_status = 'submitted', info_submitted_at = now(), info_correction_note = NULL, updated_at = now()
   WHERE case_id = p_case_id;
  PERFORM public.log_case_event(p_case_id, 'visa_info_submitted', jsonb_build_object('by', v_uid));
END $$;

-- Admin / team review.
CREATE OR REPLACE FUNCTION public.review_visa_info(p_case_id uuid, p_decision text, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR (public.has_role(v_uid, 'team_member'::public.app_role) AND (
          EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND c.assigned_to = v_uid)
       OR EXISTS (SELECT 1 FROM public.cases c JOIN public.profiles p ON p.id = c.student_user_id
                  WHERE c.id = p_case_id AND p.created_by = v_uid)))
  ) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_decision NOT IN ('checked','needs_correction') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  IF p_decision = 'needs_correction' AND length(trim(coalesce(p_note,''))) = 0 THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;
  UPDATE public.visa_applications
     SET info_status = p_decision,
         info_correction_note = CASE WHEN p_decision = 'needs_correction' THEN left(trim(p_note), 2000) ELSE NULL END,
         info_checked_at = CASE WHEN p_decision = 'checked' THEN now() ELSE info_checked_at END,
         info_checked_by = v_uid,
         updated_at = now()
   WHERE case_id = p_case_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'VISA_INFO_NOT_FOUND'; END IF;
  PERFORM public.log_case_event(p_case_id, 'visa_info_' || p_decision, jsonb_build_object('by', v_uid));
END $$;

REVOKE ALL ON FUNCTION public.save_my_visa_info(uuid, text, jsonb, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_my_visa_info(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_visa_info(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_visa_info(uuid, text, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_visa_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_visa_info(uuid, text, text) TO authenticated;

-- Verify:
-- select column_name from information_schema.columns where table_name='visa_applications' and column_name like 'info%';
-- select proname from pg_proc where proname in ('save_my_visa_info','submit_my_visa_info','review_visa_info');
