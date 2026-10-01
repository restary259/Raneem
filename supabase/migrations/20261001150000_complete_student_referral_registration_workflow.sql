-- Complete the direct Student Refer & Register workflow.
--
-- Direct registrations are NOT DARB-service invoices. The student pays the
-- registration invoice (course / accommodation / insurance) separately. Once
-- that payment is confirmed, staff review the already-completed registration,
-- submit it to Admin without creating a second DARB-service invoice, and the
-- normal enrollment milestone later creates the isolated student referral reward.
--
-- This migration is intentionally additive and keeps the existing case_services
-- / case_payments finance contract untouched.

CREATE OR REPLACE FUNCTION public.confirm_direct_registration_profile(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_invoice RECORD;
  v_submission RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id, c.source, c.status, c.assigned_to, c.case_reference
    INTO v_case
    FROM public.cases c
   WHERE c.id = p_case_id
     AND c.deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF v_case.source <> 'student_referral_registration' THEN
    RAISE EXCEPTION 'This action is only available for direct student registrations';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR v_case.assigned_to = v_uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to confirm this registration';
  END IF;

  SELECT *
    INTO v_invoice
    FROM public.case_registration_invoices i
   WHERE i.case_id = p_case_id
   ORDER BY i.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND OR v_invoice.payment_status <> 'paid' OR v_invoice.status <> 'paid' THEN
    RAISE EXCEPTION 'The registration invoice must be paid before the case can be confirmed';
  END IF;

  SELECT *
    INTO v_submission
    FROM public.case_submissions s
   WHERE s.case_id = p_case_id
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration submission not found';
  END IF;

  IF v_submission.profile_completed_at IS NULL THEN
    RAISE EXCEPTION 'The registration profile is incomplete';
  END IF;

  IF v_case.status <> 'profile_completion' THEN
    IF v_case.status = 'payment_confirmed' THEN
      RETURN jsonb_build_object(
        'case_id', p_case_id,
        'case_status', v_case.status,
        'status', 'already_confirmed'
      );
    END IF;
    RAISE EXCEPTION 'Registration must be in profile_completion before confirmation';
  END IF;

  UPDATE public.case_submissions
     SET payment_confirmed = true,
         payment_confirmed_at = COALESCE(payment_confirmed_at, now()),
         payment_confirmed_by = COALESCE(payment_confirmed_by, v_uid),
         updated_at = now()
   WHERE case_id = p_case_id;

  UPDATE public.cases
     SET status = 'payment_confirmed',
         updated_at = now()
   WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'student_referral_registration_confirmed',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'payment_method', (
        SELECT p.payment_method
          FROM public.case_registration_payments p
         WHERE p.invoice_id = v_invoice.id
           AND p.status = 'confirmed'
         ORDER BY p.confirmed_at DESC NULLS LAST, p.created_at DESC
         LIMIT 1
      ),
      'confirmed_by', v_uid
    ),
    true
  );

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'case_status', 'payment_confirmed',
    'status', 'confirmed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_direct_registration_profile(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.submit_student_referral_registration_for_review(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_case RECORD;
  v_invoice RECORD;
  v_submission RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.id, c.source, c.status, c.assigned_to, c.case_reference, c.full_name
    INTO v_case
    FROM public.cases c
   WHERE c.id = p_case_id
     AND c.deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found';
  END IF;

  IF v_case.source <> 'student_referral_registration' THEN
    RAISE EXCEPTION 'This action is only available for direct student registrations';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR v_case.assigned_to = v_uid
  ) THEN
    RAISE EXCEPTION 'Not allowed to submit this registration';
  END IF;

  IF v_case.status = 'submitted' THEN
    RETURN jsonb_build_object(
      'case_id', p_case_id,
      'case_status', 'submitted',
      'status', 'already_submitted'
    );
  END IF;

  IF v_case.status <> 'payment_confirmed' THEN
    RAISE EXCEPTION 'Registration must be payment_confirmed before submission';
  END IF;

  SELECT *
    INTO v_invoice
    FROM public.case_registration_invoices i
   WHERE i.case_id = p_case_id
   ORDER BY i.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND OR v_invoice.payment_status <> 'paid' OR v_invoice.status <> 'paid' THEN
    RAISE EXCEPTION 'The registration invoice is not paid';
  END IF;

  SELECT *
    INTO v_submission
    FROM public.case_submissions s
   WHERE s.case_id = p_case_id
   LIMIT 1;

  IF NOT FOUND OR v_submission.profile_completed_at IS NULL OR COALESCE(v_submission.payment_confirmed, false) = false THEN
    RAISE EXCEPTION 'The registration must be complete and payment-confirmed before submission';
  END IF;

  -- Direct registrations already have their registration invoice and dashboard
  -- activation path. Do NOT call issue_case_invoice and do NOT create a second
  -- DARB-service invoice here.
  UPDATE public.cases
     SET status = 'submitted',
         updated_at = now()
   WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'student_referral_registration_submitted',
    jsonb_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'submitted_by', v_uid
    ),
    true
  );

  RETURN jsonb_build_object(
    'case_id', p_case_id,
    'case_reference', v_case.case_reference,
    'case_status', 'submitted',
    'student_name', v_case.full_name,
    'status', 'submitted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_referral_registration_for_review(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.record_student_referral_registration_reward(p_case_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case RECORD;
  v_referral RECORD;
  v_reward integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('student_registration_reward:' || p_case_id::text));

  SELECT id, source, status, case_reference, referred_by, commission_split_done
    INTO v_case
    FROM public.cases
   WHERE id = p_case_id
   FOR UPDATE;

  IF NOT FOUND OR v_case.source <> 'student_referral_registration' THEN
    RETURN;
  END IF;

  IF v_case.status IS DISTINCT FROM 'enrollment_paid' THEN
    RAISE EXCEPTION 'Student registration reward can only be recorded at enrollment_paid';
  END IF;

  IF v_case.commission_split_done THEN
    RETURN;
  END IF;

  SELECT id, referrer_user_id, referral_type
    INTO v_referral
    FROM public.referrals
   WHERE referred_case_id = p_case_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND OR v_referral.referrer_user_id IS NULL THEN
    RAISE EXCEPTION 'Direct registration has no referral attribution';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = v_referral.referrer_user_id
       AND ur.role = 'student'
  ) THEN
    RAISE EXCEPTION 'Direct registration referrer must be a student';
  END IF;

  v_reward := GREATEST(
    0,
    COALESCE(
      public.get_student_referral_reward(
        v_referral.referrer_user_id,
        v_referral.referral_type
      ),
      0
    )
  );

  IF v_reward > 0 THEN
    INSERT INTO public.rewards (
      user_id,
      amount,
      currency,
      status,
      case_id,
      referral_id,
      reward_type,
      source_user_id,
      admin_notes,
      recipient_role,
      case_reference,
      rate_used,
      base_amount,
      rate_source,
      unlock_at,
      created_by_event
    )
    VALUES (
      v_referral.referrer_user_id,
      v_reward,
      'ILS',
      'pending',
      p_case_id,
      v_referral.id,
      'student_referral',
      v_referral.referrer_user_id,
      'Student ' || COALESCE(v_referral.referral_type, 'referral') ||
        ' reward from direct registration ' || COALESCE(v_case.case_reference, p_case_id::text),
      'student',
      v_case.case_reference,
      v_reward,
      0,
      'student_referral_registration_policy',
      now() + interval '20 days',
      'student_referral_registration_enrollment_paid'
    )
    ON CONFLICT (case_id, user_id, reward_type) WHERE case_id IS NOT NULL DO NOTHING;
  END IF;

  UPDATE public.referrals
     SET status = 'rewarded'
   WHERE id = v_referral.id
     AND status IS DISTINCT FROM 'rewarded';

  UPDATE public.cases
     SET commission_split_done = true,
         updated_at = now()
   WHERE id = p_case_id;

  PERFORM public.log_case_event(
    p_case_id,
    'student_referral_reward_created',
    jsonb_build_object(
      'referral_id', v_referral.id,
      'referrer_user_id', v_referral.referrer_user_id,
      'referral_type', v_referral.referral_type,
      'reward_amount_ils', v_reward,
      'reward_created', v_reward > 0,
      'unlock_days', 20
    ),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_student_referral_registration_reward(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_referral_registration_reward(uuid) TO service_role;


CREATE OR REPLACE FUNCTION public.auto_split_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'enrollment_paid' AND OLD.status IS DISTINCT FROM 'enrollment_paid' THEN
    IF NOT NEW.commission_split_done THEN
      IF NEW.source = 'student_referral_registration' THEN
        PERFORM public.record_student_referral_registration_reward(NEW.id);
      ELSE
        PERFORM public.record_case_commission(NEW.id, 0);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_split_payment ON public.cases;
CREATE TRIGGER trg_auto_split_payment
  AFTER UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.auto_split_payment();
