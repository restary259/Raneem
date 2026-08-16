/**
 * Student onboarding state.
 *
 * Nothing in the database stores this as a column — it is derived from signals
 * that already exist so there is a single, consistent answer everywhere it is
 * displayed (Student Management list, student detail, case page).
 */
import { toneClasses } from "@/lib/statusTokens";

export type OnboardingStatus =
  | "no_account"
  | "invited"
  | "activated"
  | "profile_required"
  | "profile_completed"
  | "active";

export interface OnboardingSignals {
  /** The case (or student record) has a linked auth user. */
  hasAccount: boolean;
  /** A durable invitation exists and has not been accepted yet. */
  invitationPending?: boolean;
  /** Account still carries the temporary password from provisioning. */
  mustChangePassword?: boolean | null;
  /** `case_submissions.profile_completed_at` for the linked case. */
  profileCompletedAt?: string | null;
  /** The student has signed in / touched their profile at least once. */
  lastActiveAt?: string | null;
}

export function deriveOnboardingStatus(s: OnboardingSignals): OnboardingStatus {
  if (!s.hasAccount) return s.invitationPending ? "invited" : "no_account";
  // A pending invitation on an existing account still means "not activated".
  if (s.invitationPending) return "invited";
  if (s.mustChangePassword) return "activated";
  if (!s.profileCompletedAt) return "profile_required";
  if (s.lastActiveAt) return "active";
  return "profile_completed";
}

/** i18n key under the `onboarding` namespace in dashboard.json. */
export function onboardingStatusKey(status: OnboardingStatus): string {
  switch (status) {
    case "no_account":
      return "onboarding.noAccount";
    case "invited":
      return "onboarding.invited";
    case "activated":
      return "onboarding.activated";
    case "profile_required":
      return "onboarding.profileRequired";
    case "profile_completed":
      return "onboarding.profileCompleted";
    case "active":
      return "onboarding.active";
  }
}

/** Badge tone per status — resolved through the shared semantic tone system
 *  so it is identical in light, dark and aurora. */
export function onboardingStatusTone(status: OnboardingStatus): string {
  switch (status) {
    case "no_account":
      return toneClasses("neutral").chip;
    case "invited":
      return toneClasses("payment").chip;
    case "activated":
    case "profile_required":
      return toneClasses("submitted").chip;
    case "profile_completed":
    case "active":
      return toneClasses("enrolled").chip;
  }
}
