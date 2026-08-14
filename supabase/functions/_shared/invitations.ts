/**
 * Durable account invitations.
 *
 * An invitation is a real database row, not a Supabase auth token. That makes
 * the activation link re-openable, device independent and survivable across
 * refreshes, while the master-partner / case attribution stays server side.
 */

export const APP_URL = "https://darb.agency";

export type InvitationType = "student" | "partner" | "team" | "ambassador" | "agent";

export interface CreateInvitationInput {
  invitedEmail: string;
  invitationType: InvitationType;
  intendedRole: "student" | "social_media_partner" | "team_member" | "ambassador" | "agent";
  /** Shown in the account once the invitation is accepted. */
  invitedName?: string | null;
  inviterId?: string | null;
  masterPartnerId?: string | null;
  agentId?: string | null;
  caseId?: string | null;
  recruitApplicationId?: string | null;
  /** Days until the link stops working. */
  ttlDays?: number;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Thrown when a live invitation already exists for the same email + type under
 * a DIFFERENT recruiter (a different master_partner_id or agent_id). The recruit
 * belongs to the recruiter who first invited them, so the conflict surfaces as a
 * 409 instead of silently revoking and re-attributing the original invitation.
 */
export class InvitationConflictError extends Error {
  constructor(
    message: string,
    public readonly details: {
      invitation_type: InvitationType;
      master_partner_id: string | null;
      agent_id: string | null;
    },
  ) {
    super(message);
    this.name = "InvitationConflictError";
  }
}

/**
 * Creates the invitation, or refreshes the token of the pending invitation that
 * already exists for this recipient/target. Never produces a second live
 * invitation for the same person, so "resend" is always safe.
 *
 * Returns the absolute activation URL on the production domain.
 */
export async function createInvitation(
  // deno-lint-ignore no-explicit-any
  admin: any,
  input: CreateInvitationInput,
): Promise<string> {
  const email = input.invitedEmail.trim().toLowerCase();
  const token = randomToken();
  const token_hash = await hashToken(token);
  const expires_at = new Date(
    Date.now() + (input.ttlDays ?? 7) * 24 * 60 * 60 * 1000,
  ).toISOString();

  let query = admin
    .from("user_invitations")
    .select("id, master_partner_id, agent_id")
    .eq("status", "pending")
    .ilike("invited_email", email)
    .eq("invitation_type", input.invitationType);
  query = input.recruitApplicationId
    ? query.eq("recruit_application_id", input.recruitApplicationId)
    : input.caseId
      ? query.eq("case_id", input.caseId)
      : query;

  const { data: existing } = await query.maybeSingle();

  // ── Recruiter-attribution conflict ─────────────────────────────────────
  // A recruit belongs to the recruiter who first invited them. A live
  // invitation for the same email + type under ANOTHER recruiter must not be
  // silently revoked (that would steal attribution). Same-recruiter duplicates
  // (e.g. re-invites across cases) are still refreshed below.
  const { data: siblings, error: siblingsError } = await admin
    .from("user_invitations")
    .select("id, master_partner_id, agent_id")
    .eq("status", "pending")
    .ilike("invited_email", email)
    .eq("invitation_type", input.invitationType)
    .neq("id", existing?.id ?? "");
  if (siblingsError) throw new Error(siblingsError.message);

  const myAttribution = `${input.masterPartnerId ?? "none"}:${input.agentId ?? "none"}`;
  const conflicting = siblings?.find(
    (s: { master_partner_id: string | null; agent_id: string | null }) =>
      `${s.master_partner_id ?? "none"}:${s.agent_id ?? "none"}` !== myAttribution,
  );
  if (conflicting) {
    throw new InvitationConflictError(
      `An active ${input.invitationType} invitation already exists for this email under a different recruiter`,
      {
        invitation_type: input.invitationType,
        master_partner_id: conflicting.master_partner_id ?? null,
        agent_id: conflicting.agent_id ?? null,
      },
    );
  }

  const payload = {
    invited_email: email,
    invited_name: input.invitedName?.trim() || null,
    invitation_type: input.invitationType,
    intended_role: input.intendedRole,
    token_hash,
    inviter_id: input.inviterId ?? null,
    // Attribution is preserved across resends: a null incoming value keeps the
    // original recruiter instead of wiping it.
    master_partner_id: input.masterPartnerId ?? existing?.master_partner_id ?? null,
    agent_id: input.agentId ?? existing?.agent_id ?? null,
    case_id: input.caseId ?? null,
    recruit_application_id: input.recruitApplicationId ?? null,
    status: "pending",
    expires_at,
  };

  if (existing?.id) {
    const { error } = await admin
      .from("user_invitations")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("user_invitations").insert(payload);
    if (error) throw new Error(error.message);
  }

  // Only one live invitation per recipient, type and recruiter: revoke every
  // other pending invitation for this email so an older link can never be used
  // to activate against a stale case. Attribution conflicts were already
  // rejected above; the remaining siblings share the recruiter and are
  // duplicates of this invite.
  let stale = admin
    .from("user_invitations")
    .update({ status: "revoked" })
    .eq("status", "pending")
    .ilike("invited_email", email)
    .eq("invitation_type", input.invitationType);
  if (existing?.id) stale = stale.neq("id", existing.id);
  else stale = stale.neq("token_hash", token_hash);
  await stale;

  return `${APP_URL}/activate?token=${encodeURIComponent(token)}`;
}

export interface ReconcilePendingInvitationsInput {
  email: string;
  userId: string;
  invitationType: InvitationType;
}

/**
 * Idempotently closes every pending invitation for this email + type now that
 * the corresponding account is active.
 *
 * An invitation is no longer "pending" once an active (non-deactivated) account
 * exists for that email holding the invitation's intended_role. Several account
 * creation paths (manual create-student-from-case, create-student-standalone,
 * the already-activated invite branch) never went through accept-invitation, so
 * the one row that used to flip status='pending' → 'accepted' never ran. The
 * stale pending invitation then kept rendering under "Pending invitations" while
 * the account was already active — a contradictory state.
 *
 * This helper is the single reconciliation point every account-creation path
 * calls. It is a no-op-safe UPDATE (already accepted → nothing updated), never
 * creates a second role/profile/case link, and logs a structured
 * `student_invitation_reconciled` event. It never logs tokens or passwords.
 */
export async function reconcilePendingInvitations(
  // deno-lint-ignore no-explicit-any
  admin: any,
  input: ReconcilePendingInvitationsInput,
): Promise<number> {
  const email = input.email.trim().toLowerCase();
  const userId = input.userId;

  const { data, error } = await admin
    .from("user_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq("status", "pending")
    .ilike("invited_email", email)
    .eq("invitation_type", input.invitationType)
    .select("id");

  if (error) {
    // Non-fatal: reconciliation is defense-in-depth. The DB trigger covers the
    // same transition, so a failed helper update must never break account
    // creation. Surface the error in logs (no secrets) for diagnosis.
    console.warn("reconcilePendingInvitations: update failed", {
      email,
      invitation_type: input.invitationType,
      user_id: userId,
      error,
    });
    return 0;
  }

  const closed = data?.length ?? 0;
  if (closed > 0) {
    console.info("student_invitation_reconciled", {
      email,
      invitation_type: input.invitationType,
      user_id: userId,
      closed,
    });
  }
  return closed;
}
