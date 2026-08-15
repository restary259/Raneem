-- important_contacts_attachment_audit.sql
-- Diagnostic audit: what school is each Important Contact attached to?
-- Safe to run on production: read-only, no DDL, no writes. Paste the whole
-- file into the Supabase SQL editor.
--
-- Purpose:
--  The admin "Important Contacts" list filters by School, Country, Category and
--  Status. Choosing a specific school returns nothing when a contact's
--  language_school_id does not match any row in `schools` (or when no contact
--  actually targets that school). This script prints EVERY contact with its
--  current attachment so you can see what needs to change, then run the fix.

-- ── 1. Every contact with its resolved school attachment ───────────────
-- This is the "table" of existing contacts + attachment.
--  * scope           = universal | school_city | school_only | city_only
--  * language_school_id = the school UUID the contact is attached to (raw)
--  * attached_school    = the school NAME that UUID resolves to
--  * attachment_state   = 'ok' | 'missing' | 'none'
SELECT
  ic.id,
  ic.name_en,
  ic.name_ar,
  ic.scope,
  ic.is_universal,
  ic.language_school_id,
  sch.name_en  AS attached_school_en,
  sch.name_ar  AS attached_school_ar,
  sch.city     AS school_city,
  ic.city      AS contact_city,
  ic.country,
  ic.category,
  ic.is_active,
  ic.display_order,
  CASE
    WHEN ic.language_school_id IS NULL THEN 'none'
    WHEN sch.id IS NULL THEN 'missing'
    ELSE 'ok'
  END AS attachment_state
FROM public.important_contacts ic
LEFT JOIN public.schools sch ON sch.id = ic.language_school_id
ORDER BY attachment_state, sch.name_en, ic.display_order;

-- ── 2. The schools the filter dropdown shows ───────────────────────────
-- These are the exact values the School filter offers (active + inactive).
SELECT
  id,
  name_en,
  name_ar,
  city,
  country,
  is_active
FROM public.schools
ORDER BY name_en;

-- ── 3. Contacts with broken / inconsistent attachment ──────────────────
-- Contacts whose attachment cannot be shown by any school filter:
--  * missing   – language_school_id set but no matching schools row
--  * none      – school_* scope without a school
--  * mismatched – is_universal flag that disagrees with scope
SELECT
  ic.id,
  ic.name_en,
  ic.name_ar,
  ic.scope,
  ic.is_universal,
  ic.language_school_id,
  CASE
    WHEN ic.scope IN ('school_city', 'school_only') AND ic.language_school_id IS NULL THEN 'school scope without a school'
    WHEN ic.language_school_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.schools s WHERE s.id = ic.language_school_id
    ) THEN 'school id does not exist in schools'
    WHEN (ic.scope = 'universal' AND ic.is_universal IS NOT TRUE)
      OR (ic.scope <> 'universal' AND ic.is_universal IS NOT FALSE) THEN 'is_universal disagrees with scope'
    ELSE 'none'
  END AS problem
FROM public.important_contacts ic
WHERE (ic.scope IN ('school_city', 'school_only') AND ic.language_school_id IS NULL)
   OR (ic.language_school_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.schools s WHERE s.id = ic.language_school_id
      ))
   OR (ic.scope = 'universal' AND ic.is_universal IS NOT TRUE)
   OR (ic.scope <> 'universal' AND ic.is_universal IS NOT FALSE)
ORDER BY ic.name_en;

-- ── 4. Contacts per scope ──────────────────────────────────────────────
-- Quick summary of how many contacts are universal vs school-attached.
SELECT scope, COUNT(*) AS contacts
FROM public.important_contacts
GROUP BY scope
ORDER BY scope;

-- ── 5. Attached contacts per school ────────────────────────────────────
-- For each school, how many contacts are attached to it. A school with 0
-- contacts is why selecting it in the filter shows an empty list.
SELECT
  sch.id,
  sch.name_en,
  sch.name_ar,
  COUNT(ic.id) AS attached_contacts
FROM public.schools sch
LEFT JOIN public.important_contacts ic ON ic.language_school_id = sch.id
GROUP BY sch.id, sch.name_en, sch.name_ar
ORDER BY attached_contacts DESC, sch.name_en;

-- ── Reference: how to change a contact's attachment ────────────────────
-- Once section 1 shows which contact should point at which school, fix each
-- row with an UPDATE like this (fill in the real UUIDs from section 1/2):
--
-- UPDATE public.important_contacts
--    SET language_school_id = '<school_uuid_from_section_2>',  -- the school
--        scope              = 'school_only',
--        is_universal       = false,
--        city               = NULL
--  WHERE id = '<contact_uuid_from_section_1>';
--
-- To make a contact visible to ALL students (no school filter needed):
--
-- UPDATE public.important_contacts
--    SET language_school_id = NULL,
--        scope              = 'universal',
--        is_universal       = true,
--        city               = NULL
--  WHERE id = '<contact_uuid_from_section_1>';
