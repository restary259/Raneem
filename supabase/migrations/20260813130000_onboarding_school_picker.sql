-- School picker in the student onboarding wizard + live school-contacts preview.
--
-- The wizard's "Language school" step was a free-text input. It is now a
-- dropdown of active `schools`, and the student's choice is persisted as an
-- authoritative FK on `profiles`. Selecting a school also previews the
-- important contacts that apply to it (universal + school/city scoped), using
-- the SAME matching rules as the student's real Important Contacts page.
--
-- To keep matching in ONE place, the core predicate lives in
-- `get_school_important_contacts(p_school_id, p_city)` and the existing
-- `get_student_important_contacts()` resolver delegates to it (resolving the
-- student's school from case_submissions.school_id, falling back to the
-- profile's onboarding choice when the case has no school yet).

-- ── 1. profiles.language_school_id ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_school_id uuid
    REFERENCES public.schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_language_school_id
  ON public.profiles (language_school_id);

-- ── 2. Core matcher: contacts visible to a student at a given school/city ─
-- p_city overrides the school's city (used by the student resolver to pass a
-- case city); when NULL the school's own city is used. With no school and no
-- city, only universal contacts are returned.
CREATE OR REPLACE FUNCTION public.get_school_important_contacts(
  p_school_id uuid,
  p_city text DEFAULT NULL
)
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
  WITH ctx AS (
    SELECT
      p_school_id AS v_school_id,
      COALESCE(NULLIF(p_city, ''), sch.city, '') AS v_city
    FROM (SELECT 1) _dummy
    LEFT JOIN public.schools sch ON sch.id = p_school_id
  )
  SELECT
    ic.id, ic.name_ar, ic.name_en, ic.role_ar, ic.role_en, ic.phone, ic.email,
    ic.link, ic.category, ic.city, ic.country, ic.address_ar, ic.address_en,
    ic.source_url, ic.last_verified_at, ic.display_order,
    CASE
      WHEN ic.scope = 'universal'   THEN 'universal'
      WHEN ic.scope = 'school_only' THEN 'school'
      WHEN ic.scope = 'city_only'   THEN 'city'
      WHEN ic.scope = 'school_city' THEN 'school_city'
    END AS match_scope
  FROM public.important_contacts ic
  WHERE ic.is_active
    AND (
      ic.scope = 'universal'
      OR (
        ic.scope = 'school_only'
        AND ic.language_school_id = (SELECT v_school_id FROM ctx)
      )
      OR (
        ic.scope = 'city_only'
        AND COALESCE(ic.city, '') <> ''
        AND COALESCE(ic.city, '') = (SELECT v_city FROM ctx)
      )
      OR (
        ic.scope = 'school_city'
        AND ic.language_school_id = (SELECT v_school_id FROM ctx)
        AND COALESCE(ic.city, '') = (SELECT v_city FROM ctx)
      )
    )
  ORDER BY ic.display_order, ic.name_en;
$$;

REVOKE ALL ON FUNCTION public.get_school_important_contacts(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_important_contacts(uuid, text) TO authenticated;

-- ── 3. Student resolver → delegates to the core matcher ─────────────────
-- Resolves the student's active school + city from their most-recent
-- non-deleted case, falling back to the language school they picked during
-- onboarding (profiles.language_school_id) when the case has no school. The
-- city is the school's city (NOT profiles.city, which is birth city), falling
-- back to the case city — matching the original resolver's behaviour.
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
  WITH resolved AS (
    SELECT
      COALESCE(sub.school_id, prof.language_school_id) AS v_school_id,
      COALESCE(sch.city, c.city, '') AS v_city
    FROM public.cases c
    LEFT JOIN public.case_submissions sub
           ON sub.case_id = c.id AND sub.deleted_at IS NULL
    LEFT JOIN public.profiles prof ON prof.id = c.student_user_id
    LEFT JOIN public.schools sch
           ON sch.id = COALESCE(sub.school_id, prof.language_school_id)
    WHERE c.student_user_id = auth.uid()
      AND c.deleted_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  )
  SELECT * FROM public.get_school_important_contacts(
    (SELECT v_school_id FROM resolved),
    (SELECT v_city FROM resolved)
  );
$$;

REVOKE ALL ON FUNCTION public.get_student_important_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_important_contacts() TO authenticated;
