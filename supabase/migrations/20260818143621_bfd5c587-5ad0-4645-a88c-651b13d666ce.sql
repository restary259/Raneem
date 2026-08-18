CREATE TABLE IF NOT EXISTS public.documents_library (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'operations',
  doc_kind TEXT NOT NULL DEFAULT 'guide',
  language TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'draft',
  current_version TEXT NOT NULL DEFAULT '1.0',
  effective_date DATE,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_library_kind_chk CHECK (doc_kind IN ('guide','contract','form')),
  CONSTRAINT documents_library_status_chk CHECK (status IN ('draft','published','archived')),
  CONSTRAINT documents_library_lang_chk CHECK (language IN ('ar','he','en','de'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents_library TO authenticated;
GRANT ALL ON public.documents_library TO service_role;
ALTER TABLE public.documents_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage document library"
  ON public.documents_library FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents_library(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_note TEXT,
  pdf_path TEXT,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_versions_unique UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON public.document_versions(document_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage document versions"
  ON public.document_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_documents_library_updated_at ON public.documents_library;
CREATE TRIGGER update_documents_library_updated_at
  BEFORE UPDATE ON public.documents_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_versions_updated_at ON public.document_versions;
CREATE TRIGGER update_document_versions_updated_at
  BEFORE UPDATE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();