import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { identityConflictMessage } from "./identityConflict";

// Minimal stand-in for i18next's t(): resolves known role keys and
// interpolates {{token}} placeholders from the options, so tests don't
// depend on the loaded locale catalog.
const t = ((key: string, options?: any) => {
  const roles: Record<string, string> = {
    "admin.team.partnerRole": "Partner",
    "admin.team.studentRole": "student",
    "admin.team.someRole": "another",
  };
  if (key in roles) return roles[key];
  let out = options?.defaultValue ?? "";
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
  }
  return out;
}) as TFunction;

describe("identityConflictMessage", () => {
  it("returns null for a non-conflict response", () => {
    expect(
      identityConflictMessage({ error: "nope", code: "OTHER" }, t),
    ).toBeNull();
    expect(identityConflictMessage(null, t)).toBeNull();
    expect(identityConflictMessage(undefined, t)).toBeNull();
  });

  it("describes an active social_media_partner conflict", () => {
    const msg = identityConflictMessage(
      {
        error: "This email already belongs to another account.",
        code: "identity_conflict",
        existing_role: "social_media_partner",
        deactivated: false,
      },
      t,
    );
    expect(msg).toContain("Partner");
    expect(msg).toContain("one role");
  });

  it("describes a deactivated conflict differently", () => {
    const msg = identityConflictMessage(
      {
        code: "identity_conflict",
        existing_role: "social_media_partner",
        deactivated: true,
      },
      t,
    );
    expect(msg).toContain("deactivated");
    expect(msg).toContain("Reactivate");
  });

  it("falls back to a generic role when the role is unknown", () => {
    const msg = identityConflictMessage(
      { code: "identity_conflict", existing_role: "mystery_role", deactivated: false },
      t,
    );
    expect(msg).toContain("another");
  });
});
