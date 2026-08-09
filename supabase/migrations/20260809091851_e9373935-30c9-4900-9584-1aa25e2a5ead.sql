-- Extend the source -> category mapping with the new event sources.
CREATE OR REPLACE FUNCTION public.notification_category_for_source(_source text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _source IN ('direct_message', 'case_message', 'chat') THEN 'messages'
    WHEN _source IN ('appointment', 'appointment_reminder') THEN 'appointments'
    WHEN _source IN ('case', 'case_status', 'case_event', 'student_profile_updated',
                     'case_created', 'case_assigned', 'case_submitted') THEN 'cases'
    WHEN _source IN ('payout', 'payment', 'commission', 'enrollment') THEN 'payments'
    WHEN _source IN ('document', 'document_request', 'document_uploaded') THEN 'documents'
    WHEN _source IN ('profile', 'profile_incomplete') THEN 'profile'
    WHEN _source IN ('recruit', 'recruitment', 'partner_recruit', 'recruit_application') THEN 'recruitment'
    ELSE 'system'
  END
$function$;

-- Shared insert helper: one notification, deduped, never for the actor themselves.
CREATE OR REPLACE FUNCTION public.emit_notification(
  _user_id uuid,
  _actor_id uuid,
  _source text,
  _title_en text,
  _title_ar text,
  _body_en text,
  _body_ar text,
  _case_id uuid DEFAULT NULL,
  _link text DEFAULT NULL,
  _dedupe_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications
    (user_id, title, body, source, title_en, title_ar, body_en, body_ar, case_id, link, dedupe_key)
  VALUES
    (_user_id, _title_en, _body_en, _source, _title_en, _title_ar, _body_en, _body_ar,
     _case_id, _link, _dedupe_key)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_notification(uuid, uuid, text, text, text, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Fan out every case-timeline event to the roles that need to know.
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
      v_source := 'appointment'; v_to_admin := true; v_to_team := true;
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

-- Student sign-in alerts.
CREATE OR REPLACE FUNCTION public.notify_student_signin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first  boolean;
  v_name   text;
  v_team   uuid;
  v_admin  uuid;
  v_day    text := to_char(now(), 'YYYYMMDD');
BEGIN
  IF NOT public.has_role(NEW.user_id, 'student') THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.active_sessions s
    WHERE s.user_id = NEW.user_id AND s.session_id <> NEW.session_id
  ) INTO v_first;

  SELECT COALESCE(full_name, 'Student') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT assigned_to INTO v_team FROM public.cases
   WHERE student_user_id = NEW.user_id AND deleted_at IS NULL
   ORDER BY created_at DESC LIMIT 1;

  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.emit_notification(
      v_admin, NULL, 'student_signin',
      CASE WHEN v_first THEN 'Student activated their account' ELSE 'Student signed in' END,
      CASE WHEN v_first THEN 'قام الطالب بتفعيل حسابه' ELSE 'قام الطالب بتسجيل الدخول' END,
      v_name, v_name, NULL, '/admin/students',
      -- One alert per student per day for repeat sign-ins.
      CASE WHEN v_first THEN NULL
           ELSE 'signin:' || NEW.user_id::text || ':' || v_day || ':' || v_admin::text END);
  END LOOP;

  IF v_first AND v_team IS NOT NULL THEN
    PERFORM public.emit_notification(
      v_team, NULL, 'student_signin',
      'Student activated their account', 'قام الطالب بتفعيل حسابه',
      v_name, v_name, NULL, '/team/students', NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_signin ON public.active_sessions;
CREATE TRIGGER trg_notify_student_signin
AFTER INSERT ON public.active_sessions
FOR EACH ROW EXECUTE FUNCTION public.notify_student_signin();

-- New partner recruit application.
CREATE OR REPLACE FUNCTION public.notify_recruit_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.emit_notification(
      v_admin, NULL, 'recruit_application',
      'New partner application', 'طلب شراكة جديد',
      COALESCE(NEW.full_name, ''), COALESCE(NEW.full_name, ''), NULL, '/admin/team', NULL);
  END LOOP;

  IF NEW.master_partner_id IS NOT NULL THEN
    PERFORM public.emit_notification(
      NEW.master_partner_id, NULL, 'recruit_application',
      'Someone applied through your link', 'قدّم شخص عبر رابطك',
      COALESCE(NEW.full_name, ''), COALESCE(NEW.full_name, ''), NULL, '/partner/network', NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_recruit_application ON public.partner_recruit_applications;
CREATE TRIGGER trg_notify_recruit_application
AFTER INSERT ON public.partner_recruit_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_recruit_application();

-- New partnership / contact form submission.
CREATE OR REPLACE FUNCTION public.notify_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.emit_notification(
      v_admin, NULL, 'system',
      'New form submission', 'رسالة جديدة من الموقع',
      COALESCE(NEW.form_source, 'contact'), COALESCE(NEW.form_source, 'contact'),
      NULL, '/admin/inbox', NULL);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contact_submission ON public.contact_submissions;
CREATE TRIGGER trg_notify_contact_submission
AFTER INSERT ON public.contact_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_contact_submission();