import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { activationErrorMessage } from "./activateErrors";

const t = ((key: string, opts?: Record<string, unknown>): string => {
  const dict: Record<string, string> = {
    "activate.emailMismatch": "emailMismatch",
    "activate.expired": "expired",
    "activate.accepted": "accepted",
    "activate.revoked": "revoked",
    "activate.weakPassword": "weakPassword",
    "activate.invalid": "invalid",
    "activate.identityConflict": "conflict:{{role}}",
    "activate.identityConflictDeactivated": "deactivated",
    "activate.anotherRole": "another",
    "activate.roleAdmin": "Admin",
    "activate.roleTeamMember": "Team",
    "activate.rolePartner": "Partner",
    "activate.roleAmbassador": "Ambassador",
    "activate.roleStudent": "Student",
  };
  const fallback = (template: string) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(opts?.[name] ?? ""));
  if (!dict[key]) return opts?.defaultValue ? fallback(String(opts.defaultValue)) : key;
  return fallback(dict[key]);
}) as unknown as TFunction;

describe("activationErrorMessage", () => {
  it("returns null for unknown codes and empty payloads", () => {
    expect(activationErrorMessage(null, t)).toBeNull();
    expect(activationErrorMessage(undefined, t)).toBeNull();
    expect(activationErrorMessage({}, t)).toBeNull();
    expect(activationErrorMessage({ code: "server_error" }, t)).toBeNull();
  });

  it("maps the pre-existing activation states", () => {
    expect(activationErrorMessage({ code: "email_mismatch" }, t)).toBe("emailMismatch");
    expect(activationErrorMessage({ code: "expired" }, t)).toBe("expired");
    expect(activationErrorMessage({ code: "accepted" }, t)).toBe("accepted");
    expect(activationErrorMessage({ code: "revoked" }, t)).toBe("revoked");
    expect(activationErrorMessage({ code: "weak_password" }, t)).toBe("weakPassword");
    expect(activationErrorMessage({ code: "invalid" }, t)).toBe("invalid");
  });

  it("localizes a known conflicting role", () => {
    expect(
      activationErrorMessage({ code: "identity_conflict", existing_role: "social_media_partner" }, t),
    ).toBe("conflict:Partner");
    expect(
      activationErrorMessage({ code: "identity_conflict", existing_role: "student" }, t),
    ).toBe("conflict:Student");
  });

  it("falls back to the raw role for unknown roles", () => {
    expect(
      activationErrorMessage({ code: "identity_conflict", existing_role: "mystery_role" }, t),
    ).toBe("conflict:mystery_role");
  });

  it("reports deactivated accounts distinctly", () => {
    expect(
      activationErrorMessage({ code: "identity_conflict", deactivated: true, existing_role: "student" }, t),
    ).toBe("deactivated");
  });
});
