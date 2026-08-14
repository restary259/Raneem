-- ============================================================
-- Student Overview: visa RLS tightening + document-upload
-- in-app notification trigger.
-- ============================================================
-- Goals (presentational/permissions only — no new business data):
--   1. Team members can READ their assigned students' visa info but can
--      NO LONGER write it (the FOR ALL "Team manage assigned visa values"
--      and "Team manage assigned visa applications" policies are replaced
--      with SELECT-only). Admin keeps full access. This makes the
--      "team must not edit visa" rule enforced at the database, not just by
--      hiding the UI button.
--   2. When a staff member (team/admin) uploads a document FOR a student,
--      the student receives an in-app notification naming the document and
--      the actor. Student self-uploads never notify (the uploader is the
--      student). This reuses the existing `notifications` table + DB-trigger
--      pattern (same as notify_student_profile_update /
--      notify_case_status_change) — no new infrastructure.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. visa_field_values: team → SELECT only (read-only)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Team manage assigned visa values" ON public.visa_field_values;
DROP POLICY IF EXISTS "Team read assigned visa values" ON public.visa_field_values;

CREATE POLICY "Team read assigned visa values"
ON public.visa_field_values
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.student_user_id = visa_field_values.student_user_id
      AND c.assigned_to = auth.uid()
  )
);

-- (Admin "Admins manage visa values" FOR ALL policy is unchanged;
--  student INSERT/UPDATE policies from 20260810210100 are unchanged.)

-- ────────────────────────────────────────────────────────────
-- 2. visa_applications: team → SELECT only (read-only)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Team manage assigned visa applications" ON public.visa_applications;
DROP POLICY IF EXISTS "Team read assigned visa applications" ON public.visa_applications;

CREATE POLICY "Team read assigned visa applications"
ON public.visa_applications
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = visa_applications.case_id
      AND c.assigned_to = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. Notify the student when a staff member uploads a document.
--    SECURITY DEFINER so it can INSERT into notifications regardless of
--    the acting user. Only fires when the uploader is NOT the student
--    (i.e. a team/admin upload) and the doc is visible to the student.
--    Idempotent enough: one row per document insert, never spammy.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_student_document_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_actor_name   TEXT;
  v_case_id      UUID;
  v_title_en     TEXT;
  v_title_ar     TEXT;
  v_body_en      TEXT;
  v_body_ar      TEXT;
BEGIN
  -- Student self-uploads (uploaded_by is null or equals the student) do not
  -- notify — only staff-added documents are meaningful to the student.
  IF NEW.uploaded_by IS NULL OR NEW.uploaded_by = NEW.student_id THEN
    RETURN NEW;
  END IF;

  IF NOT COALESCE(NEW.is_visible_to_student, true) THEN
    RETURN NEW;
  END IF;

  -- Resolve the actor's display name for a human-readable message.
  SELECT COALESCE(p.full_name, p.email) INTO v_actor_name
  FROM public.profiles p
  WHERE p.id = NEW.uploaded_by;

  IF v_actor_name IS NULL OR v_actor_name = '' THEN
    v_actor_name := 'Your Darb team';
  END IF;

  -- Resolve the case id (for the notification's case_id link) — fall back to
  -- a case linked by student if the row's case_id is null.
  v_case_id := NEW.case_id;
  IF v_case_id IS NULL THEN
    SELECT c.id INTO v_case_id
    FROM public.cases c
    WHERE c.student_user_id = NEW.student_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  v_title_en := 'New document added';
  v_title_ar := 'تمت إضافة مستند جديد';
  v_body_en  := v_actor_name || ' added a new document to your case: ' || NEW.file_name;
  v_body_ar  := v_actor_name || ' أضاف مستنداً جديداً إلى ملفك: ' || NEW.file_name;

  INSERT INTO public.notifications (
    user_id, title, body, source, metadata,
    title_en, title_ar, body_en, body_ar, case_id
  ) VALUES (
    NEW.student_id,
    v_title_en,
    v_body_en,
    'document_added',
    jsonb_build_object('document_id', NEW.id, 'document_name', NEW.file_name, 'actor_id', NEW.uploaded_by, 'category', NEW.category),
    v_title_en, v_title_ar, v_body_en, v_body_ar, v_case_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_document_added ON public.documents;
CREATE TRIGGER trg_student_document_added
  AFTER INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_document_added();
