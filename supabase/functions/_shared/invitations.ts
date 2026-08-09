/**
 * Durable account invitations.
 *
 * An invitation is a real database row, not a Supabase auth token. That makes
 * the activation link re-openable, device independent and survivable across
 * refreshes, while the master-partner / case attribution stays server side.
 */

export const APP_URL = "https://darb.agency";

export type InvitationType = "student" | "partner" | "team" | "ambassador";

export interface CreateInvitationInput {
  invitedEmail: string;
  invitationType: InvitationType;
  intendedRole: "student" | "social_media_partner" | "team_member" | "ambassador";
  /** Shown in the account once the invitation is accepted. */
  invitedName?: string | null;
  inviterId?: string | null;
  masterPartnerId?: string | null;
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
    .select("id")
    .eq("status", "pending")
    .ilike("invited_email", email)
    .eq("invitation_type", input.invitationType);
  query = input.recruitApplicationId
    ? query.eq("recruit_application_id", input.recruitApplicationId)
    : input.caseId
      ? query.eq("case_id", input.caseId)
      : query;

  const { data: existing } = await query.maybeSingle();

  const payload = {
    invited_email: email,
    invited_name: input.invitedName?.trim() || null,
    invitation_type: input.invitationType,
    intended_role: input.intendedRole,
    token_hash,
    inviter_id: input.inviterId ?? null,
    master_partner_id: input.masterPartnerId ?? null,
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

  // Only one live invitation per recipient and type: revoke every other
  // pending invitation for this email so an older link can never be used to
  // activate against a stale case.
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
