-- Fix Task 1: Drop the permissive policy that leaks ALL student profiles to ALL team members.
-- Policy A ("Team members can view students they created") already correctly enforces created_by = auth.uid().
-- Policy B below overrides it via PERMISSIVE OR logic, giving every team member access to every student.
DROP POLICY IF EXISTS "Team can view student profiles" ON public.profiles;