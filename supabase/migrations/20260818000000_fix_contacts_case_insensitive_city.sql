-- Case-insensitive city matching for important-contacts targeting.
--
-- The city comparisons in get_school_important_contacts used `=` (exact,
-- case-sensitive): if schools.city = 'Heidelberg' but a contact's city =
-- 'heidelberg', the match fails silently and the student sees no city contacts.
--
-- Fix: lowercase BOTH sides of the comparison. The ctx CTE now lowercases the
-- resolved v_city (p_city override → school city), and the city_only /
-- school_city branches compare lower(ic.city). get_student_important_contacts()
-- delegates to this function, so the student path inherits the fix; the
-- onboarding preview (StudentOnboardingGate) does too. Signature, return
-- shape, match_scope mapping, ORDER BY, security attributes, and grants are
-- unchanged — only the comparison becomes case-insensitive.
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
      lower(COALESCE(NULLIF(p_city, ''), sch.city, '')) AS v_city
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
