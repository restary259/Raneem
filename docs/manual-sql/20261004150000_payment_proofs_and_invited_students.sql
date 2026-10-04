-- Manual deploy. Replaces the earlier case_invoices policy snippet.
-- 1) Live submit_case_payment_proof writes a "note" column that is missing.
ALTER TABLE public.case_payment_proofs ADD COLUMN IF NOT EXISTS note text;

-- 2) Students cannot SELECT public.cases, so policies that subquery cases
--    always hid their own invoice/proofs. Use a narrow definer helper.
CREATE OR REPLACE FUNCTION public.can_read_case(_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id
      AND c.deleted_at IS NULL
      AND (c.assigned_to = auth.uid() OR c.student_user_id = auth.uid())
  )
$$;
REVOKE ALL ON FUNCTION public.can_read_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_case(uuid) TO authenticated;

GRANT SELECT ON public.case_invoices TO authenticated;
DROP POLICY IF EXISTS "Case members read invoices" ON public.case_invoices;
CREATE POLICY "Case members read invoices" ON public.case_invoices
  FOR SELECT TO authenticated USING (public.can_read_case(case_id));

DROP POLICY IF EXISTS "Students read own payment proofs" ON public.case_payment_proofs;
CREATE POLICY "Students read own payment proofs" ON public.case_payment_proofs
  FOR SELECT TO authenticated USING (public.can_read_case(case_id));

-- 3) Invited students: record the inviting team member as created_by.
CREATE OR REPLACE FUNCTION public.set_created_by_from_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND NEW.accepted_user_id IS NOT NULL AND NEW.inviter_id IS NOT NULL
     AND NEW.invitation_type = 'student' THEN
    UPDATE public.profiles SET created_by = NEW.inviter_id
    WHERE id = NEW.accepted_user_id AND created_by IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_created_by_from_invitation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_created_by_from_invitation ON public.user_invitations;
CREATE TRIGGER trg_set_created_by_from_invitation
  AFTER INSERT OR UPDATE OF status, accepted_user_id ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by_from_invitation();

-- 4) Backfill already-accepted student invitations (only empty values).
UPDATE public.profiles p
SET created_by = i.inviter_id
FROM public.user_invitations i
WHERE i.accepted_user_id = p.id
  AND i.status = 'accepted'
  AND i.invitation_type = 'student'
  AND i.inviter_id IS NOT NULL
  AND p.created_by IS NULL;
