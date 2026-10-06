-- MANUAL DEPLOY. Additive only: nothing is dropped, changed or deleted.
-- Student "Visa Information" form, keyed by STUDENT (not case) so a student
-- can fill it from day one, before a study file exists. Students write only
-- through the RPCs below; there is no direct client write path.
-- The older case-keyed columns/RPCs on visa_applications (20261006130000)
-- stay in place but are no longer used by the app.

CREATE TABLE IF NOT EXISTS public.student_visa_info (
  student_user_id      uuid PRIMARY KEY,
  info                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  info_status          text  NOT NULL DEFAULT 'draft',
  info_last_step       int   NOT NULL DEFAULT 0,
  info_updated_at      timestamptz,
  info_submitted_at    timestamptz,
  info_checked_at      timestamptz,
  info_checked_by      uuid,
  info_correction_note text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_visa_info_status_chk
    CHECK (info_status IN ('draft','in_progress','submitted','needs_correction','checked'))
);

GRANT SELECT ON public.student_visa_info TO authenticated;
GRANT ALL ON public.student_visa_info TO service_role;

ALTER TABLE public.student_visa_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student visa info read" ON public.student_visa_info;
CREATE POLICY "Student visa info read"
ON public.student_visa_info
FOR SELECT TO authenticated
USING (
  student_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'team_member'::public.app_role) AND (
      EXISTS (SELECT 1 FROM public.cases c
               WHERE c.student_user_id = student_visa_info.student_user_id
                 AND c.assigned_to = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles sp
                  WHERE sp.id = student_visa_info.student_user_id
                    AND sp.created_by = auth.uid()
                    AND sp.deleted_at IS NULL)
    )
  )
);

-- Safety-net backfill from the earlier case-keyed storage (0 rows today).
INSERT INTO public.student_visa_info (
  student_user_id, info, info_status, info_last_step, info_updated_at,
  info_submitted_at, info_checked_at, info_checked_by, info_correction_note
)
SELECT DISTINCT ON (va.student_user_id)
  va.student_user_id, va.info, va.info_status, va.info_last_step, va.info_updated_at,
  va.info_submitted_at, va.info_checked_at, va.info_checked_by, va.info_correction_note
FROM public.visa_applications va
WHERE va.student_user_id IS NOT NULL AND va.info <> '{}'::jsonb
ORDER BY va.student_user_id, va.info_updated_at DESC NULLS LAST
ON CONFLICT (student_user_id) DO NOTHING;

-- Newest live case of a student (NULL when none). Used only to log events.
CREATE OR REPLACE FUNCTION public.student_visa_info_case(p_student uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.id FROM public.cases c
   WHERE c.student_user_id = p_student AND c.deleted_at IS NULL
   ORDER BY c.created_at DESC LIMIT 1
$$;

-- Student saves one section (autosave).
CREATE OR REPLACE FUNCTION public.save_my_student_visa_info(
  p_section text, p_payload jsonb, p_last_step int
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_status text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(v_uid, 'student'::public.app_role) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_section NOT IN ('personal','family','contact','passport','travel','previous','background','financing','review') THEN
    RAISE EXCEPTION 'INVALID_SECTION';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR length(p_payload::text) > 20000 THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD';
  END IF;

  SELECT info_status INTO v_status FROM public.student_visa_info WHERE student_user_id = v_uid;
  IF v_status IN ('submitted','checked') THEN RAISE EXCEPTION 'VISA_INFO_LOCKED'; END IF;

  INSERT INTO public.student_visa_info (student_user_id, info, info_status, info_last_step, info_updated_at)
  VALUES (v_uid, jsonb_build_object(p_section, p_payload), 'in_progress', greatest(0, least(coalesce(p_last_step, 0), 8)), now())
  ON CONFLICT (student_user_id) DO UPDATE
    SET info = public.student_visa_info.info || jsonb_build_object(p_section, p_payload),
        info_status = CASE WHEN public.student_visa_info.info_status = 'needs_correction'
                           THEN 'needs_correction' ELSE 'in_progress' END,
        info_last_step = greatest(0, least(coalesce(p_last_step, 0), 8)),
        info_updated_at = now(),
        updated_at = now();
END $$;

-- Student submits; required sections are checked server-side. Idempotent.
CREATE OR REPLACE FUNCTION public.submit_my_student_visa_info()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_info jsonb; v_status text; s text; v_case uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT info, info_status INTO v_info, v_status
    FROM public.student_visa_info WHERE student_user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'VISA_INFO_INCOMPLETE'; END IF;
  IF v_status IN ('submitted','checked') THEN RETURN; END IF;
  FOREACH s IN ARRAY ARRAY['personal','contact','passport','travel','previous','background','financing'] LOOP
    IF coalesce(v_info -> s, '{}'::jsonb) = '{}'::jsonb THEN
      RAISE EXCEPTION 'VISA_INFO_INCOMPLETE:%', s;
    END IF;
  END LOOP;
  IF coalesce(v_info -> 'review' ->> 'confirmed', 'false') <> 'true' THEN
    RAISE EXCEPTION 'VISA_INFO_NOT_CONFIRMED';
  END IF;
  UPDATE public.student_visa_info
     SET info_status = 'submitted', info_submitted_at = now(), info_correction_note = NULL, updated_at = now()
   WHERE student_user_id = v_uid;
  v_case := public.student_visa_info_case(v_uid);
  IF v_case IS NOT NULL THEN
    PERFORM public.log_case_event(v_case, 'visa_info_submitted', jsonb_build_object('by', v_uid));
  END IF;
END $$;

-- Admin / team review (creator of the student or assigned team member).
CREATE OR REPLACE FUNCTION public.review_student_visa_info(p_student_id uuid, p_decision text, p_note text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_case uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT (
    public.has_role(v_uid, 'admin'::public.app_role)
    OR (public.has_role(v_uid, 'team_member'::public.app_role) AND (
          EXISTS (SELECT 1 FROM public.cases c WHERE c.student_user_id = p_student_id AND c.assigned_to = v_uid)
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_student_id AND p.created_by = v_uid AND p.deleted_at IS NULL)))
  ) THEN RAISE EXCEPTION 'NOT_ALLOWED'; END IF;
  IF p_decision NOT IN ('checked','needs_correction') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  IF p_decision = 'needs_correction' AND length(trim(coalesce(p_note,''))) = 0 THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;
  UPDATE public.student_visa_info
     SET info_status = p_decision,
         info_correction_note = CASE WHEN p_decision = 'needs_correction' THEN left(trim(p_note), 2000) ELSE NULL END,
         info_checked_at = CASE WHEN p_decision = 'checked' THEN now() ELSE info_checked_at END,
         info_checked_by = v_uid,
         updated_at = now()
   WHERE student_user_id = p_student_id AND info_status = 'submitted';
  IF NOT FOUND THEN RAISE EXCEPTION 'VISA_INFO_NOT_SUBMITTED'; END IF;
  v_case := public.student_visa_info_case(p_student_id);
  IF v_case IS NOT NULL THEN
    PERFORM public.log_case_event(v_case, 'visa_info_' || p_decision, jsonb_build_object('by', v_uid));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.student_visa_info_case(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_my_student_visa_info(text, jsonb, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_my_student_visa_info() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_student_visa_info(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_student_visa_info(text, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_student_visa_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_student_visa_info(uuid, text, text) TO authenticated;

-- Verify:
-- select to_regclass('public.student_visa_info');
-- select polname from pg_policy where polrelid = 'public.student_visa_info'::regclass;
-- select proname from pg_proc where proname in
--   ('save_my_student_visa_info','submit_my_student_visa_info','review_student_visa_info','student_visa_info_case');
