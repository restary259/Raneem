-- DARB Document Center — foundation extras.
-- The base tables (documents_library + document_versions), their RLS, the
-- darb-documents storage policies, and generated types already exist (captured
-- in 20260818143621 + 20260818143644). This migration fills the remaining gaps:
--   1. Create the private `darb-documents` storage bucket itself (the 446
--      migration only declared the storage *policies*, not the bucket row).
--   2. Auto-sync documents_library.current_version from the latest
--      document_versions row so the editor never has to maintain it by hand.
--   3. A SECURITY DEFINER `seed_starter_documents(p_docs jsonb)` RPC so the
--      admin "Seed starter documents" button (and migrations) can upsert the
--      built-in guides idempotently from the TS-authored block arrays.

-- ── 1. Bucket creation (idempotent) ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('darb-documents', 'darb-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── 2. current_version sync ─────────────────────────────────────────────
-- Whenever a document_versions row is inserted or its version changes, push
-- the newest version string onto the parent documents_library row. Kept in a
-- SECURITY DEFINER function so it can UPDATE documents_library regardless of
-- the caller's role (the editor autosave runs as the authenticated admin, who
-- has UPDATE, but this guarantees correctness even for service-role inserts).

CREATE OR REPLACE FUNCTION public.sync_documents_library_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest text;
BEGIN
  SELECT version
    INTO v_latest
    FROM public.document_versions
    WHERE document_id = NEW.document_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

  IF v_latest IS NOT NULL THEN
    UPDATE public.documents_library
       SET current_version = v_latest
     WHERE id = NEW.document_id
       AND current_version <> v_latest;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_versions_sync_current
  ON public.document_versions;
CREATE TRIGGER trg_documents_versions_sync_current
  AFTER INSERT OR UPDATE OF version, document_id ON public.document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_documents_library_current_version();

-- ── 3. seed_starter_documents(p_docs jsonb) ──────────────────────────────
-- p_docs is a JSON array of objects shaped like:
--   { slug, title, subtitle, description, category, doc_kind, language,
--     status, current_version, content: [<DocBlock[]>], change_note }
-- The RPC upserts documents_library (ON CONFLICT slug) and document_versions
-- (ON CONFLICT (document_id, version)) idempotently. SECURITY DEFINER so the
-- admin button (authenticated) and any seed migration (service_role) share one
-- trusted path. Returns a summary row set for diagnostics.

CREATE OR REPLACE FUNCTION public.seed_starter_documents(p_docs jsonb)
RETURNS TABLE(slug text, version text, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc jsonb;
  v_doc_id uuid;
  v_existing_version text;
  v_row record;
BEGIN
  FOR doc IN SELECT * FROM jsonb_array_elements(p_docs)
  LOOP
    SELECT id INTO v_doc_id
      FROM public.documents_library
      WHERE slug = doc->>'slug';

    IF v_doc_id IS NULL THEN
      INSERT INTO public.documents_library
        (slug, title, subtitle, description, category, doc_kind, language,
         status, current_version)
      VALUES
        (doc->>'slug', doc->>'title', NULLIF(doc->>'subtitle',''),
         NULLIF(doc->>'description',''), COALESCE(doc->>'category','operations'),
         COALESCE(doc->>'doc_kind','guide'), COALESCE(doc->>'language','ar'),
         COALESCE(doc->>'status','draft'), COALESCE(doc->>'current_version','1.0'))
      RETURNING id INTO v_doc_id;
      v_row.slug := doc->>'slug';
      v_row.version := COALESCE(doc->>'current_version','1.0');
      v_row.action := 'inserted_library';
      RETURN NEXT;
    ELSE
      v_row.slug := doc->>'slug';
      v_row.version := COALESCE(doc->>'current_version','1.0');
      v_row.action := 'exists_library';
      RETURN NEXT;
    END IF;

    SELECT version INTO v_existing_version
      FROM public.document_versions
      WHERE document_id = v_doc_id
        AND version = COALESCE(doc->>'current_version','1.0');

    IF v_existing_version IS NULL THEN
      INSERT INTO public.document_versions
        (document_id, version, content, change_note)
      VALUES
        (v_doc_id, COALESCE(doc->>'current_version','1.0'),
         COALESCE(doc->'content', '[]'::jsonb),
         COALESCE(doc->>'change_note', 'Initial version'));
      v_row.slug := doc->>'slug';
      v_row.version := COALESCE(doc->>'current_version','1.0');
      v_row.action := 'inserted_version';
      RETURN NEXT;
    ELSE
      v_row.slug := doc->>'slug';
      v_row.version := v_existing_version;
      v_row.action := 'exists_version';
      RETURN NEXT;
    END IF;
  END LOOP;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_starter_documents(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_documents(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.seed_starter_documents(jsonb) FROM anon;
