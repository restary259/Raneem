-- P2.8: notify the student when their appointment outcome is recorded.
--
-- `appointment_scheduled` and `appointment_rescheduled` already notify the
-- student via notify_case_event, but `appointment_outcome` only reached
-- admin/team. When a team member records an outcome (completed / cancelled /
-- no_show / rescheduled / delayed) the student had no idea their appointment
-- was closed out. This recreation adds the student to that branch.

CREATE OR REPLACE FUNCTION public.notify_case_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case       RECORD;
  v_source     text;
  v_title_en   text;
  v_title_ar   text;
  v_body_en    text;
  v_body_ar    text;
  v_to_admin   boolean := false;
  v_to_team    boolean := false;
  v_to_partner boolean := false;
  v_to_student boolean := false;
  v_ref        text;
  v_partner    uuid;
  v_dedupe     text;
  v_admin      uuid;
BEGIN
  -- Chat already has its own notification path.
  IF NEW.event_type = 'message_sent' THEN
    RETURN NEW;
  END IF;

  SELECT id, assigned_to, partner_id, referred_by, student_user_id, case_reference, full_name
    INTO v_case
  FROM public.cases
  WHERE id = NEW.case_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_ref := COALESCE(v_case.case_reference, left(v_case.id::text, 8));
  v_partner := COALESCE(v_case.partner_id, v_case.referred_by);

  CASE NEW.event_type
    WHEN 'case_created' THEN
      v_source := 'case_created'; v_to_admin := true; v_to_partner := true;
      v_title_en := 'New case'; v_title_ar := 'ملف جديد';
    WHEN 'case_assigned' THEN
      v_source := 'case_assigned'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Case assigned'; v_title_ar := 'تم إسناد الملف';
    WHEN 'appointment_scheduled' THEN
      v_source := 'appointment'; v_to_admin := true; v_to_team := true; v_to_student := true;
      v_title_en := 'Appointment scheduled'; v_title_ar := 'تم تحديد موعد';
    WHEN 'appointment_rescheduled' THEN
      v_source := 'appointment'; v_to_admin := true; v_to_team := true; v_to_student := true;
      v_title_en := 'Appointment rescheduled'; v_title_ar := 'تم تغيير الموعد';
    WHEN 'appointment_outcome' THEN
      v_source := 'appointment'; v_to_admin := true; v_to_team := true; v_to_student := true;
      v_title_en := 'Appointment result recorded'; v_title_ar := 'تم تسجيل نتيجة الموعد';
    WHEN 'profile_updated' THEN
      v_source := 'student_profile_updated'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Student profile updated'; v_title_ar := 'تم تحديث ملف الطالب';
    WHEN 'student_account_created' THEN
      v_source := 'student_profile_updated'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Student account created'; v_title_ar := 'تم إنشاء حساب الطالب';
    WHEN 'service_added' THEN
      v_source := 'case'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Service added to case'; v_title_ar := 'تمت إضافة خدمة للملف';
    WHEN 'payment_received' THEN
      v_source := 'payment'; v_to_admin := true; v_to_team := true; v_to_partner := true; v_to_student := true;
      v_title_en := 'Payment received'; v_title_ar := 'تم استلام دفعة';
    WHEN 'case_submitted' THEN
      v_source := 'case_submitted'; v_to_admin := true; v_to_team := true; v_to_partner := true; v_to_student := true;
      v_title_en := 'Case submitted to school'; v_title_ar := 'تم تقديم الملف للجامعة';
    WHEN 'enrollment_paid' THEN
      v_source := 'enrollment'; v_to_admin := true; v_to_team := true; v_to_partner := true; v_to_student := true;
      v_title_en := 'Enrollment confirmed'; v_title_ar := 'تم تأكيد التسجيل';
    WHEN 'document_requested' THEN
      v_source := 'document_request'; v_to_team := true; v_to_student := true;
      v_title_en := 'Document requested'; v_title_ar := 'تم طلب مستند';
    WHEN 'document_uploaded' THEN
      v_source := 'document_uploaded'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Document uploaded'; v_title_ar := 'تم رفع مستند';
    WHEN 'stage_advanced' THEN
      v_source := 'case_status'; v_to_admin := true; v_to_team := true; v_to_student := true;
      v_title_en := 'Case moved to the next stage'; v_title_ar := 'انتقل الملف إلى المرحلة التالية';
    WHEN 'status_changed' THEN
      v_source := 'case_status'; v_to_admin := true; v_to_team := true;
      v_title_en := 'Case status changed'; v_title_ar := 'تم تغيير حالة الملف';
    ELSE
      RETURN NEW;
  END CASE;

  v_body_en := 'Case ' || v_ref;
  v_body_ar := 'الملف ' || v_ref;

  -- Collapse stage/status churn on the same case inside one minute.
  IF NEW.event_type IN ('stage_advanced', 'status_changed') THEN
    v_dedupe := 'case_stage:' || NEW.case_id::text || ':'
                || to_char(date_trunc('minute', NEW.created_at), 'YYYYMMDDHH24MI');
  END IF;

  IF v_to_admin THEN
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.emit_notification(
        v_admin, NEW.actor_id, v_source, v_title_en, v_title_ar, v_body_en, v_body_ar,
        NEW.case_id, '/admin/cases/' || NEW.case_id::text,
        CASE WHEN v_dedupe IS NULL THEN NULL ELSE v_dedupe || ':' || v_admin::text END);
    END LOOP;
  END IF;

  IF v_to_team AND v_case.assigned_to IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_case.assigned_to, NEW.actor_id, v_source, v_title_en, v_title_ar, v_body_en, v_body_ar,
      NEW.case_id, '/team/cases/' || NEW.case_id::text,
      CASE WHEN v_dedupe IS NULL THEN NULL ELSE v_dedupe || ':' || v_case.assigned_to::text END);
  END IF;

  -- Partners get milestones only, and never any student detail.
  IF v_to_partner AND v_partner IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_partner, NEW.actor_id, v_source, v_title_en, v_title_ar,
      'One of your referred students has an update', 'يوجد تحديث لأحد طلابك',
      NULL, '/partner/students', NULL);
  END IF;

  -- Internal timeline entries never reach the student.
  IF v_to_student AND NOT COALESCE(NEW.is_internal, false) AND v_case.student_user_id IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_case.student_user_id, NEW.actor_id, v_source, v_title_en, v_title_ar,
      'Your application was updated', 'تم تحديث طلبك',
      NEW.case_id, NULL,
      CASE WHEN v_dedupe IS NULL THEN NULL ELSE v_dedupe || ':' || v_case.student_user_id::text END);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_case_event ON public.case_events;
CREATE TRIGGER trg_notify_case_event
AFTER INSERT ON public.case_events
FOR EACH ROW EXECUTE FUNCTION public.notify_case_event();
