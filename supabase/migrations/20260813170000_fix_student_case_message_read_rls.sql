-- Fix: students could send but not read case messages.
--
-- Root cause: the "Student reads shared messages on own case" SELECT policy
-- (created in 20260811115642_...) used
--   EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_messages.case_id
--           AND c.student_user_id = auth.uid())
-- That subquery over public.cases is itself evaluated under cases RLS. The
-- student's direct SELECT policy on cases ("Students can view own case") was
-- dropped in 20260808165358_... (replaced by the SECURITY DEFINER my_case
-- view / get_my_case() RPC), so for a student the subquery returns zero rows
-- and the policy denies every read. Sending still worked because
-- send_case_message is SECURITY DEFINER and reads cases directly; team/admin
-- reading worked because their FOR ALL policies on cases keep the rows
-- visible to them.
--
-- Fix: replace the raw EXISTS ... FROM public.cases with a call to the
-- existing SECURITY DEFINER helper public.can_access_case_thread(case_id,
-- user_id), which reads cases with the owner's privileges (bypassing cases
-- RLS) and returns true for the student whose student_user_id matches, for
-- the assigned team_member, and for admins. The visibility = 'shared' AND
-- deleted_at IS NULL clauses stay, so students still cannot read
-- internal-visibility or soft-deleted messages. Staff already get full read
-- via the separate "Assigned team reads case messages" policy (and admins via
-- their cases FOR ALL policy), so routing the student policy through
-- can_access_case_thread does not expose anything new to them.
--
-- Note: can_access_case_thread is created in 20260808080331_... as
--   SECURITY DEFINER STABLE, returns
--   has_role(_user_id,'admin') OR EXISTS(... assigned_to OR student_user_id ...)
-- and is granted to authenticated + service_role only.

DROP POLICY IF EXISTS "Student reads shared messages on own case" ON public.case_messages;

CREATE POLICY "Student reads shared messages on own case"
ON public.case_messages
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND visibility = 'shared'
  AND public.can_access_case_thread(case_messages.case_id, auth.uid())
);

-- Verification (run as a student whose auth.uid() = c.student_user_id):
--   SELECT count(*) FROM case_messages
--   WHERE case_id = '<own case id>' AND deleted_at IS NULL AND visibility='shared';
--   -- should return > 0 (was 0 before this migration)
--   SELECT count(*) FROM case_messages
--   WHERE case_id = '<own case id>' AND visibility='internal';
--   -- should still return 0 (students never see internal messages)
