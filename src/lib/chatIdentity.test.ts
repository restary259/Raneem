import { describe, it, expect } from "vitest";
import { ADMIN_DISPLAY_ROLES, chatDisplayName } from "./chatIdentity";

const ADMIN_LABEL = "Administration";

describe("chatDisplayName", () => {
  it("hides the real admin name from non-staff viewers", () => {
    expect(chatDisplayName("Raneem", "admin", "partner", ADMIN_LABEL)).toBe(ADMIN_LABEL);
    expect(chatDisplayName("Raneem", "admin", "student", ADMIN_LABEL)).toBe(ADMIN_LABEL);
    expect(chatDisplayName("Raneem", "admin", null, ADMIN_LABEL)).toBe(ADMIN_LABEL);
  });

  it("shows the real admin name to staff viewers", () => {
    expect(chatDisplayName("Raneem", "admin", "admin", ADMIN_LABEL)).toBe("Raneem");
    expect(chatDisplayName("Raneem", "admin", "team_member", ADMIN_LABEL)).toBe("Raneem");
  });

  it("shows non-admin participants by name to everyone", () => {
    expect(chatDisplayName("Sami", "partner", "student", ADMIN_LABEL)).toBe("Sami");
  });

  it("falls back to the admin label when the name is blank", () => {
    expect(chatDisplayName("   ", "partner", "admin", ADMIN_LABEL)).toBe(ADMIN_LABEL);
    expect(chatDisplayName(null, "student", "admin", ADMIN_LABEL)).toBe(ADMIN_LABEL);
  });

  it("treats admin as the only masked role", () => {
    expect([...ADMIN_DISPLAY_ROLES]).toEqual(["admin"]);
  });
});
