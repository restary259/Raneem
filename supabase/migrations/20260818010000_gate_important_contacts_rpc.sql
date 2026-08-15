-- Authorize get_school_important_contacts to the caller's OWN school only.
--
-- The RPC is SECURITY DEFINER + granted to `authenticated`, so any logged-in
-- user could previously call it with an arbitrary school UUID and read that
-- school's contact names/phones/emails (school UUIDs are enumerable from the
-- `schools` table the onboarding wizard reads). This closes the gap while
-- keeping every legitimate caller working:
--
--   * admins             -> any school (preview/verification)
--   * p_school_id NULL   -> universal contacts only (a student with no school
--                            still sees universal rows, exactly as before)
--   * authenticated user -> only their OWN school: profiles.language_school_id
--                            OR the school on one of their non-deleted case
--                            submissions (the same two sources the student
--                            resolver get_student_important_contacts() uses).
--
-- Unauthorized calls return ZERO rows (no error) so client flows never throw.
-- get_student_important_contacts() delegates here, so the student Contacts
-- page is unchanged. Case-insensitive city matching from the 20260818000000
-- migration is carried forward unchanged.
--
-- NOTE: requires Supabase admin/service-role access (DDL). Not applied by the
-- Vercel build or ci.yml. Run via `supabase db push` or the dashboard SQL editor.

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
      lower(COALESCE(NULLIF(p_city, ''), sch.city, '')) AS v_city,
      public.has_role(auth.uid(), 'admin')
        OR p_school_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.language_school_id = p_school_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.cases c
          JOIN public.case_submissions sub
            ON sub.case_id = c.id AND sub.deleted_at IS NULL
          WHERE c.student_user_id = auth.uid()
            AND c.deleted_at IS NULL
            AND sub.school_id = p_school_id
        ) AS v_allowed
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
    AND (SELECT v_allowed FROM ctx)
    AND (
      ic.scope = 'universal'
      OR (
        ic.scope = 'school_only'
        AND ic.language_school_id = (SELECT v_school_id FROM ctx)
      )
      OR (
        ic.scope = 'city_only'
        AND COALESCE(ic.city, '') <> ''
        AND lower(COALESCE(ic.city, '')) = (SELECT v_city FROM ctx)
      )
      OR (
        ic.scope = 'school_city'
        AND ic.language_school_id = (SELECT v_school_id FROM ctx)
        AND lower(COALESCE(ic.city, '')) = (SELECT v_city FROM ctx)
      )
    )
  ORDER BY ic.display_order, ic.name_en;
$$;

REVOKE ALL ON FUNCTION public.get_school_important_contacts(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_school_important_contacts(uuid, text) TO authenticated;
