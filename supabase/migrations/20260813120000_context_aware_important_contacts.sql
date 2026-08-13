-- Context-aware Important Contacts targeting.
--
-- Today every signed-in student sees ALL active important_contacts rows. This
-- migration introduces data-driven targeting (universal / school+city /
-- school-only / city-only) backed by the existing `schools` table, adds a
-- SECURITY DEFINER resolver `get_student_important_contacts()` that is the
-- single source of truth for which contacts a student may see, and tightens
-- RLS so students can no longer SELECT the table directly to bypass filtering.

-- ── 1. Targeting columns ────────────────────────────────────────────────
ALTER TABLE public.important_contacts
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'universal'
    CHECK (scope IN ('universal', 'school_city', 'school_only', 'city_only')),
  ADD COLUMN IF NOT EXISTS language_school_id uuid
    REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_universal boolean NOT NULL DEFAULT true;

-- Keep legacy rows visible to everyone (unchanged behaviour) until an admin
-- re-scopes them. Rows that already carried a city but no school are still
-- universal here on purpose — the old UI showed them to all students.
UPDATE public.important_contacts
   SET scope = 'universal', is_universal = true
 WHERE scope IS NULL OR scope = 'universal';

-- A contact may only target a school when its scope involves a school.
ALTER TABLE public.important_contacts DROP CONSTRAINT IF EXISTS important_contacts_school_scope_check;
ALTER TABLE public.important_contacts ADD CONSTRAINT important_contacts_school_scope_check
  CHECK (
    (scope IN ('school_city', 'school_only') AND language_school_id IS NOT NULL)
    OR (scope IN ('universal', 'city_only') AND language_school_id IS NULL)
  );

-- A school+city contact must carry a city, a city-only contact must carry a
-- city, and a school-only contact must NOT carry a targeting city (the school
-- column already implies the location). The existing free-text `city` column
-- is reused as the targeting city.
ALTER TABLE public.important_contacts DROP CONSTRAINT IF EXISTS important_contacts_city_scope_check;
ALTER TABLE public.important_contacts ADD CONSTRAINT important_contacts_city_scope_check
  CHECK (
    (scope IN ('school_city', 'city_only') AND COALESCE(city, '') <> '')
    OR (scope IN ('universal', 'school_only') AND TRUE)
  );

-- Universal flag must agree with scope (universal ⇔ is_universal).
ALTER TABLE public.important_contacts DROP CONSTRAINT IF EXISTS important_contacts_universal_check;
ALTER TABLE public.important_contacts ADD CONSTRAINT important_contacts_universal_check
  CHECK (
    (scope = 'universal' AND is_universal = true)
    OR (scope <> 'universal' AND is_universal = false)
  );

CREATE INDEX IF NOT EXISTS idx_important_contacts_school_id
  ON public.schools (id);
CREATE INDEX IF NOT EXISTS idx_important_contacts_scope_active
  ON public.important_contacts (scope, is_active, display_order);

-- ── 2. Student resolver (single source of truth) ───────────────────────
-- Returns the contacts the calling student may see, plus a `match_scope` tag
-- ('universal' | 'school' | 'city' | 'school_city') the UI uses to group the
-- list. Filtering happens server-side; the student's school/city come from
-- their active case → case_submissions.school_id → schools row.
CREATE OR REPLACE FUNCTION public.get_student_important_contacts()
RETURNS TABLE (
  id uuid,
  name_ar text,
  name_en text,
  role_ar text,
  role_en text,
  phone text,
  email text,
  link text,
  category text,
  city text,
  country text,
  address_ar text,
  address_en text,
  source_url text,
  last_verified_at timestamptz,
  display_order integer,
  match_scope text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH student_ctx AS (
    SELECT
      sub.school_id   AS v_school_id,
      sch.city        AS v_school_city,
      c.city          AS v_case_city
    FROM public.cases c
    LEFT JOIN public.case_submissions sub
           ON sub.case_id = c.id AND sub.deleted_at IS NULL
    LEFT JOIN public.schools sch ON sch.id = sub.school_id
    WHERE c.student_user_id = auth.uid()
      AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  )
  SELECT
    ic.id, ic.name_ar, ic.name_en, ic.role_ar, ic.role_en, ic.phone, ic.email,
    ic.link, ic.category, ic.city, ic.country, ic.address_ar, ic.address_en,
    ic.source_url, ic.last_verified_at, ic.display_order,
    CASE
      WHEN ic.scope = 'universal' THEN 'universal'
      WHEN ic.scope = 'school_only' THEN 'school'
      WHEN ic.scope = 'city_only' THEN 'city'
      WHEN ic.scope = 'school_city' THEN 'school_city'
    END AS match_scope
  FROM public.important_contacts ic
  WHERE ic.is_active
    AND (
      ic.scope = 'universal'
      OR (
        ic.scope = 'school_only'
        AND ic.language_school_id = (SELECT v_school_id FROM student_ctx)
      )
      OR (
        ic.scope = 'city_only'
        AND COALESCE(ic.city, '') <> ''
        AND COALESCE(ic.city, '') = COALESCE(
          (SELECT v_school_city FROM student_ctx),
          (SELECT v_case_city   FROM student_ctx),
          ''
        )
      )
      OR (
        ic.scope = 'school_city'
        AND ic.language_school_id = (SELECT v_school_id FROM student_ctx)
        AND COALESCE(ic.city, '') = COALESCE(
          (SELECT v_school_city FROM student_ctx),
          (SELECT v_case_city   FROM student_ctx),
          ''
        )
      )
    )
  ORDER BY ic.display_order, ic.name_en;
$$;

REVOKE ALL ON FUNCTION public.get_student_important_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_important_contacts() TO authenticated;

-- ── 3. Tighten RLS ──────────────────────────────────────────────────────
-- Students must NOT be able to SELECT the whole table to bypass targeting.
-- They reach applicable contacts only through the resolver above. Admins keep
-- full management access.
DROP POLICY IF EXISTS "Roled users read active contacts" ON public.important_contacts;
DROP POLICY IF EXISTS "Authenticated users read active contacts" ON public.important_contacts;

-- Admin management (already existed; restate to be safe and explicit).
DROP POLICY IF EXISTS "Admins manage important contacts" ON public.important_contacts;
CREATE POLICY "Admins manage important contacts"
  ON public.important_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.important_contacts TO authenticated;
