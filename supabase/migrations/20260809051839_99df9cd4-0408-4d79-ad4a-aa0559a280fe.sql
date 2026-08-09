-- 1. Student data-rights requests
CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','correction','export','deletion','objection')),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  admin_note text,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.data_requests TO authenticated;
GRANT UPDATE ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own data requests"
  ON public.data_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own data requests"
  ON public.data_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update data requests"
  ON public.data_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_data_requests_updated_at
  BEFORE UPDATE ON public.data_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_data_requests_user ON public.data_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON public.data_requests(status, created_at DESC);

-- 2. Document access logging (admin / team views + downloads)
CREATE OR REPLACE FUNCTION public.log_document_access(
  _document_id uuid,
  _action text DEFAULT 'view'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc record;
  v_actor_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF _action NOT IN ('view','download','preview') THEN
    _action := 'view';
  END IF;

  SELECT id, student_id, case_id, file_name, category
    INTO v_doc
  FROM public.documents
  WHERE id = _document_id;

  IF v_doc.id IS NULL THEN
    RETURN;
  END IF;

  SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_log (actor_id, actor_name, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    COALESCE(v_actor_name, 'unknown'),
    'document_' || _action,
    'document',
    v_doc.id,
    jsonb_build_object(
      'file_name', v_doc.file_name,
      'category', v_doc.category,
      'student_id', v_doc.student_id,
      'case_id', v_doc.case_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_document_access(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_document_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_document_access(uuid, text) TO service_role;

-- 3. Missing team SELECT policy on student-documents bucket
DROP POLICY IF EXISTS "Team can read assigned student documents" ON storage.objects;
CREATE POLICY "Team can read assigned student documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-documents'
    AND public.has_role(auth.uid(), 'team_member')
    AND EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.assigned_to = auth.uid()
        AND c.student_user_id::text = (storage.foldername(name))[1]
    )
  );

-- 4. Tighten role `public` policies that already depend on the signed-in user
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname IN ('public','storage')
      AND roles::text = '{public}'
      AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ 'auth\.uid\(\)'
      AND (COALESCE(qual,'') || COALESCE(with_check,'')) NOT ILIKE '%service_role%'
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO authenticated',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END;
$$;