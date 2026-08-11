-- H2: pending invitations on the Team Students page always returned []
-- for team members because the only SELECT policy on user_invitations was
-- admin-only. Team members now read the student invitations they created
-- (inviter_id = auth.uid()), which powers the "Pending invitations" list and
-- its Resend actions on the Team Students page. Admins keep the existing
-- policy (see "Admins can view invitations").
--
-- RLS is row-level only: a caller can still read every column of their own
-- invitation rows, including token_hash. That hash is SHA-256 of the raw token
-- (see _shared/invitations.ts) and cannot be used to activate without the raw
-- token, which only travels in the emailed activation link.

CREATE POLICY "Team can view own student invitations"
  ON public.user_invitations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'team_member')
    AND invitation_type = 'student'
    AND inviter_id = auth.uid()
  );
