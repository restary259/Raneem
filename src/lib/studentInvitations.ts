/**
 * Student invitation / account-lifecycle reconciliation (frontend safeguard).
 *
 * The database is the source of truth for invitation state: a pending
 * user_invitations row is closed (status → accepted) by the
 * `reconcile_student_invitations` trigger + the edge-function
 * `reconcilePendingInvitations` helper whenever the corresponding student
 * account becomes active. This module is a *defensive* second line of defence
 * — it hides any invitation whose email already belongs to an active student
 * even if the DB reconciliation has not yet run (replication lag, a missed
 * path, etc.). It never mutates server state.
 */

export interface ActiveStudent {
  id: string;
  email: string;
}

export interface PendingInvitation {
  id: string;
  invited_email: string;
  [key: string]: unknown;
}

/** Normalize an email for comparison: trim + lowercase. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Returns the invitations that are still genuinely pending — i.e. whose
 * invited_email does NOT match any active student's email. An invitation whose
 * account is already active is not "pending" regardless of what the row says.
 */
export function filterActiveInvitations(
  invitations: PendingInvitation[],
  students: ActiveStudent[],
): PendingInvitation[] {
  const activeEmails = new Set(
    students.map((s) => normalizeEmail(s.email)).filter(Boolean),
  );
  return invitations.filter((inv) => {
    const email = normalizeEmail(inv.invited_email);
    if (!email) return true;
    return !activeEmails.has(email);
  });
}
