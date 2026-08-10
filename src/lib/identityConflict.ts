import type { TFunction } from "i18next";

/**
 * Shape of the `identity_conflict` payload returned by the edge functions
 * (create-student-from-case, invite-account, …) when an email already belongs
 * to a non-matching role.
 */
export interface IdentityConflictResult {
  error?: string;
  code?: string;
  existing_role?: string;
  deactivated?: boolean;
}

const ROLE_KEYS: Record<string, string> = {
  team_member: "admin.team.teamMemberRole",
  social_media_partner: "admin.team.partnerRole",
  ambassador: "admin.team.ambassadorRole",
  admin: "admin.team.adminRole",
  student: "admin.team.studentRole",
};

/**
 * Turns an identity-collision response into a localized, actionable message.
 * Returns null when `result` is not an `identity_conflict`, so callers can fall
 * back to the server's generic error string.
 *
 * Mirrors the pattern in AdminTeamPage so every flow that creates an account
 * reports the same conflict wording instead of the raw
 * "This email already belongs to another account."
 */
export function identityConflictMessage(
  result: IdentityConflictResult | null | undefined,
  t: TFunction,
): string | null {
  if (!result || result.code !== "identity_conflict") return null;

  const key = result.existing_role ? ROLE_KEYS[result.existing_role] : undefined;
  const existing = key
    ? t(key, result.existing_role)
    : t("admin.team.someRole", "another");

  return result.deactivated
    ? t("admin.team.conflictDeactivated", {
        role: existing,
        defaultValue:
          "This email belongs to a deactivated {{role}} account. Reactivate that account instead of creating a new one, or use a different email.",
      })
    : t("admin.team.conflictActive", {
        role: existing,
        defaultValue:
          "This email is already used by a {{role}} account. One person can hold only one role in Darb — use a different email address.",
      });
}
