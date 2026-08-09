CREATE OR REPLACE FUNCTION public.set_notification_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Producers rarely pass a category, so derive it from the source. Without this
  -- everything lands in 'system' and per-category push preferences never apply.
  IF NEW.category IS NULL OR NEW.category = 'system' THEN
    NEW.category := public.notification_category_for_source(NEW.source);
  END IF;

  IF NEW.link IS NULL THEN
    NEW.link := CASE NEW.category
      WHEN 'payments' THEN CASE
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/financials'
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team'
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student'
        ELSE '/partner/earnings' END
      WHEN 'cases' THEN CASE
        WHEN NEW.case_id IS NULL THEN NULL
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/cases/' || NEW.case_id::text
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team/cases/' || NEW.case_id::text
        ELSE NULL END
      WHEN 'appointments' THEN CASE
        WHEN public.has_role(NEW.user_id, 'team_member') THEN '/team/appointments'
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student'
        ELSE NULL END
      WHEN 'documents' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student/documents'
        ELSE NULL END
      WHEN 'profile' THEN CASE
        WHEN public.has_role(NEW.user_id, 'student') THEN '/student/profile'
        ELSE NULL END
      WHEN 'recruitment' THEN CASE
        WHEN public.has_role(NEW.user_id, 'admin') THEN '/admin/team'
        ELSE '/partner/network' END
      ELSE NULL
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_notification_category ON public.notifications;
CREATE TRIGGER trg_set_notification_category
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_notification_category();

UPDATE public.notifications
SET category = public.notification_category_for_source(source)
WHERE category IS DISTINCT FROM public.notification_category_for_source(source);