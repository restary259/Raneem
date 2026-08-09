import { describe, it, expect } from "vitest";
import { deriveOnboardingStatus } from "./onboardingStatus";

describe("deriveOnboardingStatus", () => {
  it("reports no account when nothing has been issued", () => {
    expect(deriveOnboardingStatus({ hasAccount: false })).toBe("no_account");
  });

  it("reports invited while an invitation is outstanding", () => {
    expect(deriveOnboardingStatus({ hasAccount: false, invitationPending: true })).toBe("invited");
    expect(deriveOnboardingStatus({ hasAccount: true, invitationPending: true })).toBe("invited");
  });

  it("reports activated while the temporary password is still in place", () => {
    expect(deriveOnboardingStatus({ hasAccount: true, mustChangePassword: true })).toBe("activated");
  });

  it("reports profile setup required before the case profile is completed", () => {
    expect(deriveOnboardingStatus({ hasAccount: true, mustChangePassword: false })).toBe(
      "profile_required",
    );
  });

  it("reports profile completed, then active once the student has been seen", () => {
    expect(
      deriveOnboardingStatus({ hasAccount: true, profileCompletedAt: "2026-01-01" }),
    ).toBe("profile_completed");
    expect(
      deriveOnboardingStatus({
        hasAccount: true,
        profileCompletedAt: "2026-01-01",
        lastActiveAt: "2026-02-01",
      }),
    ).toBe("active");
  });
});
