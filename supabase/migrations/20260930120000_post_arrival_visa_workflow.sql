-- ════════════════════════════════════════════════════════════════════════
-- Post-arrival Visa workflow (Admin).
--
-- Visa is a POST-ENROLLMENT operational queue layered on top of enrolled
-- cases — it is deliberately NOT a `cases.status`. `enrollment_paid` stays
-- terminal, `caseTransitions` is untouched, and no commission/enrollment code
-- changes. This migration only adds the operational data the queue needs.
--
-- It does NOT create a second status store: `visa_field_values` (field_key =
-- 'visa_status') remains the canonical operational status, exactly what the
-- student Visa page and AdminStudentsPage already read/write.
--
-- It does NOT create a second document store: files stay in `documents` /
-- `student-documents`. `visa_application_documents` only records WHICH existing
-- document rows were selected for a visa application.
--
-- MANUAL DEPLOY — DDL is not applied by the Vercel build or ci.yml. Run via
-- `supabase db push` or the dashboard SQL editor (admin/service-role only).
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────────────
-- 1. Actual arrival marker
--
-- `profiles.arrival_date` is the student's PLANNED arrival. The Visa queue
-- needs an explicit operational "actually arrived in Germany" marker, so it
-- gets its own nullable column. Never overwritten by / never overwrites the
-- planned date.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.visa_applications
  ADD COLUMN IF NOT EXISTS arrived_in_germany_at TIMESTAMPTZ;

COMMENT ON COLUMN public.visa_applications.arrived_in_germany_at IS
  'Operational marker: when the student was confirmed to have ARRIVED in Germany. Distinct from profiles.arrival_date (the planned date). Source of truth for the Admin post-arrival Visa queue. Does not change cases.status (stays enrollment_paid).';

-- Immutable audit record of the information + documents DARB used when the
-- application was submitted. Written ONCE (when the admin marks it applied);
-- never the live source of truth — live data stays in profiles /
-- visa_field_values / documents. No binary files, only ids + values.
ALTER TABLE public.visa_applications
  ADD COLUMN IF NOT EXISTS submission_snapshot JSONB;

COMMENT ON COLUMN public.visa_applications.submission_snapshot IS
  'Historical snapshot taken when the visa application was marked applied: selected visa field values, relevant profile fields, selected document ids, timestamp and admin id. Audit only — never read as live state.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. Document selection join table
--
-- Relational (not JSON) so integrity, queries and auditing are trivial and the
-- underlying `documents` row is never duplicated or deleted.
-- ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.visa_application_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_application_id UUID NOT NULL
    REFERENCES public.visa_applications(id) ON DELETE CASCADE,
  document_id         UUID NOT NULL
    REFERENCES public.documents(id) ON DELETE CASCADE,
  added_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visa_application_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_visa_app_docs_application
  ON public.visa_application_documents (visa_application_id);
CREATE INDEX IF NOT EXISTS idx_visa_app_docs_document
  ON public.visa_application_documents (document_id);
CREATE INDEX IF NOT EXISTS idx_visa_apps_case
  ON public.visa_applications (case_id);
CREATE INDEX IF NOT EXISTS idx_visa_apps_student
  ON public.visa_applications (student_user_id);
CREATE INDEX IF NOT EXISTS idx_visa_apps_arrived
  ON public.visa_applications (arrived_in_germany_at);

-- ────────────────────────────────────────────────────────────────────────
-- 3. RLS on the new table
--
-- Admin: full management. Team: read-only, scoped to their assigned cases
-- (same read-only posture migration 20260814000000 gave visa_applications).
-- Student: read-only, own documents only. Students do NOT get write access —
-- selecting documents for an official application is an Admin responsibility.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.visa_application_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage visa application documents"
  ON public.visa_application_documents;
CREATE POLICY "Admins manage visa application documents"
ON public.visa_application_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Team read assigned visa application documents"
  ON public.visa_application_documents;
CREATE POLICY "Team read assigned visa application documents"
ON public.visa_application_documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'team_member'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.visa_applications va
    JOIN public.cases c ON c.id = va.case_id
    WHERE va.id = visa_application_documents.visa_application_id
      AND c.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students read own visa application documents"
  ON public.visa_application_documents;
CREATE POLICY "Students read own visa application documents"
ON public.visa_application_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.visa_applications va
    JOIN public.documents d ON d.id = visa_application_documents.document_id
    WHERE va.id = visa_application_documents.visa_application_id
      AND d.student_id = auth.uid()
  )
);

REVOKE ALL ON public.visa_application_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visa_application_documents TO authenticated;
GRANT ALL ON public.visa_application_documents TO service_role;

-- ────────────────────────────────────────────────────────────────────────
-- 4. Admin Visa queue RPC
--
-- Admin-only (explicit role check — no UI trust). Returns exactly the columns
-- the queue renders; the browser never sees profile columns it does not need.
-- `visa_status` is read from the canonical dynamic field store, never a new
-- status column.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_visa_queue()
RETURNS TABLE (
  case_id                 uuid,
  case_reference          text,
  student_user_id         uuid,
  full_name               text,
  phone                   text,
  email                   text,
  assigned_to             uuid,
  assigned_name           text,
  enrolled_at             timestamptz,
  planned_arrival         date,
  actual_arrival          timestamptz,
  visa_status             text,
  visa_applied_at         timestamptz,
  visa_application_id     uuid,
  document_count          integer,
  selected_document_count integer,
  created_at              timestamptz,
  updated_at              timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.case_reference,
    c.student_user_id,
    COALESCE(p.full_name, c.full_name)          AS full_name,
    COALESCE(p.phone_number, c.phone_number)    AS phone,
    p.email,
    c.assigned_to,
    COALESCE(ap.full_name, ap.email)            AS assigned_name,
    cs.enrollment_paid_at,
    p.arrival_date,
    va.arrived_in_germany_at,
    COALESCE(vfv.value, 'not_applied')          AS visa_status,
    COALESCE(va.visa_applied_at, cs.enrollment_paid_at) AS visa_applied_at,
    va.id,
    COALESCE(dc.document_count, 0)::integer,
    COALESCE(sdc.selected_count, 0)::integer,
    c.created_at,
    COALESCE(va.updated_at, c.updated_at)
  FROM public.cases c
  LEFT JOIN public.profiles p            ON p.id = c.student_user_id
  LEFT JOIN public.profiles ap           ON ap.id = c.assigned_to
  LEFT JOIN public.case_submissions cs   ON cs.case_id = c.id
  LEFT JOIN public.visa_applications va  ON va.case_id = c.id
  LEFT JOIN public.visa_fields vf        ON vf.field_key = 'visa_status'
  LEFT JOIN public.visa_field_values vfv ON vfv.field_id = vf.id
                                        AND vfv.student_user_id = c.student_user_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS document_count
    FROM public.documents d
    WHERE d.student_id = c.student_user_id
      AND d.deleted_at IS NULL
  ) dc ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS selected_count
    FROM public.visa_application_documents vad
    WHERE vad.visa_application_id = va.id
  ) sdc ON true
  WHERE c.status = 'enrollment_paid'
    AND c.deleted_at IS NULL
    AND c.archived = false
    AND c.student_user_id IS NOT NULL
  ORDER BY va.arrived_in_germany_at DESC NULLS LAST, c.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_visa_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_visa_queue() TO authenticated;

COMMIT;
