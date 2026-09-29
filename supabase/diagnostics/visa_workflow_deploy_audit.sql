-- ===========================================================================
-- Post-arrival Visa workflow — live deployment audit (READ ONLY)
-- ===========================================================================
-- Run this in the Supabase dashboard SQL editor BEFORE and AFTER applying:
--   supabase/migrations/20260930120000_post_arrival_visa_workflow.sql
--   supabase/migrations/20260930130000_complete_student_visa_workflow.sql
--
-- Every column below reads an object that the application already depends on at
-- runtime, so a `false` is a real breakage — not a nice-to-have. Nothing here
-- writes or mutates data.
-- ---------------------------------------------------------------------------

SELECT 'column: visa_applications.arrived_in_germany_at' AS object,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'visa_applications'
           AND column_name = 'arrived_in_germany_at'
       ) AS present
UNION ALL
SELECT 'column: visa_applications.submission_snapshot',
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'visa_applications'
           AND column_name = 'submission_snapshot'
       )
UNION ALL
SELECT 'table: visa_application_documents',
       to_regclass('public.visa_application_documents') IS NOT NULL

-- ---------------------------------------------------------------------------
-- RPCs. The Admin Visa tab uses get_admin_visa_queue; the student Visa page
-- uses the three student RPCs. Missing any of these = runtime error.
-- ---------------------------------------------------------------------------
UNION ALL
SELECT 'function: get_admin_visa_queue()',
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'get_admin_visa_queue'
       )
UNION ALL
SELECT 'function: ensure_student_visa_application(uuid)',
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'ensure_student_visa_application'
       )
UNION ALL
SELECT 'function: mark_student_visa_arrived(uuid)',
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'mark_student_visa_arrived'
       )
UNION ALL
SELECT 'function: submit_student_visa_application(uuid)',
       EXISTS (
         SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = 'submit_student_visa_application'
       )

-- ---------------------------------------------------------------------------
-- RLS policies added/changed by these two migrations.
-- Expect ALL of these to be true after applying both.
-- ---------------------------------------------------------------------------
UNION ALL
SELECT 'policy: Admins manage visa application documents',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_application_documents'
           AND policyname = 'Admins manage visa application documents'
       )
UNION ALL
SELECT 'policy: Team read assigned visa application documents',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_application_documents'
           AND policyname = 'Team read assigned visa application documents'
       )
UNION ALL
SELECT 'policy: Students read own visa application documents',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_application_documents'
           AND policyname = 'Students read own visa application documents'
       )
UNION ALL
SELECT 'policy: Students insert own non-status visa values',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_field_values'
           AND policyname = 'Students insert own non-status visa values'
       )
UNION ALL
SELECT 'policy: Students update own non-status visa values',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_field_values'
           AND policyname = 'Students update own non-status visa values'
       )

-- ===========================================================================
-- The two legacy policies below MUST be ABSENT after 20260930130000. If either
-- is still present, a student can write `visa_status` (and, for
-- "Students manage own visa", arbitrary visa_applications rows) — that is the
-- status-drift hole these migrations were written to close.
-- ===========================================================================
UNION ALL
SELECT 'LEGACY policy still present (should be FALSE): Students manage own visa',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_applications'
           AND policyname = 'Students manage own visa'
       )
UNION ALL
SELECT 'LEGACY policy still present (should be FALSE): Students insert own visa values',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_field_values'
           AND policyname = 'Students insert own visa values'
       )
UNION ALL
SELECT 'LEGACY policy still present (should be FALSE): Students update own visa values',
       EXISTS (
         SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'visa_field_values'
           AND policyname = 'Students update own visa values'
       )
ORDER BY object;
