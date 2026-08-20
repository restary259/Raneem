import type { TFunction } from "i18next";

/**
 * Error payload returned by the accept-invitation edge function on a non-2xx
 * response. `existing_role` / `deactivated` only appear on `identity_conflict`.
 */
export interface ActivationErrorPayload extends Record<string, unknown> {
  code?: string;
  existing_role?: string;
  deactivated?: boolean;
}

const ROLE_KEYS: Record<string, string> = {
  admin: "activate.roleAdmin",
  team_member: "activate.roleTeamMember",
  social_media_partner: "activate.rolePartner",
  ambassador: "activate.roleAmbassador",
  student: "activate.roleStudent",
};

/**
 * Turns an accept-invitation error payload into a localized, state-aware
 * message. Returns null for unknown codes so callers can fall back to the
 * server's error string.
 */
export function activationErrorMessage(
  payload: ActivationErrorPayload | null | undefined,
  t: TFunction,
): string | null {
  const code = typeof payload?.code === "string" ? payload.code : undefined;
  switch (code) {
    case "email_mismatch":
      return t("activate.emailMismatch");
    case "expired":
      return t("activate.expired");
    case "accepted":
      return t("activate.accepted");
    case "revoked":
      return t("activate.revoked");
    case "weak_password":
      return t("activate.weakPassword");
    case "invalid":
      return t("activate.invalid");
    case "email_exists":
      return t("activate.emailExists", {
        defaultValue:
          "We couldn't complete activation for this email. Contact the DARB team.",
      });
    case "identity_conflict": {
      const existingRole = typeof payload.existing_role === "string" ? payload.existing_role : undefined;
      const key = existingRole ? ROLE_KEYS[existingRole] : undefined;
      const role = key
        ? t(key)
        : existingRole ?? t("activate.anotherRole", "another");
      return payload.deactivated
        ? t("activate.identityConflictDeactivated", {
            defaultValue:
              "This account has been deactivated. Ask the DARB team to reactivate it before continuing.",
          })
        : t("activate.identityConflict", {
            role,
            defaultValue:
              "This email already has the role {{role}} in DARB. One person can hold only one role — sign in with that account instead.",
          });
    }
    default:
      return null;
  }
}
