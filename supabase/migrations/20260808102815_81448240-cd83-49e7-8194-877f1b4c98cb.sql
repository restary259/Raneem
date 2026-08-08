CREATE OR REPLACE FUNCTION public.request_case_changes(
  p_case_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text := btrim(coalesce(p_note, ''));
  v_submission_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF v_note = '' OR length(v_note) > 2000 THEN
    RAISE EXCEPTION 'A change note between 1 and 2000 characters is required';
  END IF;

  SELECT cs.id INTO v_submission_id
  FROM public.case_submissions cs
  JOIN public.cases c ON c.id = cs.case_id
  WHERE cs.case_id = p_case_id
    AND cs.deleted_at IS NULL
    AND c.status = 'submitted'
  FOR UPDATE OF cs, c;

  IF v_submission_id IS NULL THEN
    RAISE EXCEPTION 'Submitted case not found';
  END IF;

  UPDATE public.case_submissions
  SET review_status = 'changes_requested',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = v_note
  WHERE id = v_submission_id;

  UPDATE public.cases
  SET status = 'profile_completion'
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'changes_requested',
    jsonb_build_object('note', v_note),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_case_changes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_case_changes(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resubmit_case_for_review(
  p_case_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case public.cases%ROWTYPE;
  v_submission public.case_submissions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_case
  FROM public.cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT (public.has_role(auth.uid(), 'team_member'::public.app_role) AND v_case.assigned_to = auth.uid()) THEN
    RAISE EXCEPTION 'This case is not assigned to you';
  END IF;

  SELECT * INTO v_submission
  FROM public.case_submissions
  WHERE case_id = p_case_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_submission.review_status IS DISTINCT FROM 'changes_requested' THEN
    RAISE EXCEPTION 'This case is not awaiting corrections';
  END IF;
  IF v_case.status <> 'profile_completion' THEN
    RAISE EXCEPTION 'Case is not in the correction stage';
  END IF;
  IF v_submission.profile_completed_at IS NULL THEN
    RAISE EXCEPTION 'The student profile must be complete first';
  END IF;
  IF coalesce(v_submission.payment_confirmed, false) = false THEN
    RAISE EXCEPTION 'Payment must remain confirmed before resubmission';
  END IF;

  UPDATE public.case_submissions
  SET review_status = 'submitted',
      review_note = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      submitted_by = auth.uid(),
      submitted_at = now()
  WHERE id = v_submission.id;

  UPDATE public.cases
  SET status = 'submitted'
  WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'case_resubmitted',
    '{}'::jsonb,
    false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resubmit_case_for_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_case_for_review(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_student_case_profile_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_user_id IS NOT NULL
     AND NEW.student_user_id IS DISTINCT FROM OLD.student_user_id THEN
    UPDATE public.profiles
    SET case_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.student_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_case_profile_link ON public.cases;
CREATE TRIGGER trg_sync_student_case_profile_link
AFTER UPDATE OF student_user_id ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_case_profile_link();