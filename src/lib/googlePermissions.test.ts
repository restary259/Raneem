import { describe, it, expect } from "vitest";
import {
  GOOGLE_ACTIONS,
  canGoogleOfficeAction,
  type GoogleActorContext,
} from "./googlePermissions";

/**
 * The client mirror must agree with the server's
 * `authorize_google_office_action`. These cases are the same matrix exercised
 * against Postgres in the Phase 1 verification script, so a drift between the
 * two shows up here.
 */

const admin: GoogleActorContext = {
  isAdmin: true,
  isOfficeMember: true,
  operatorRole: null,
};
const primary: GoogleActorContext = {
  isAdmin: false,
  isOfficeMember: true,
  operatorRole: "PRIMARY",
};
const side: GoogleActorContext = {
  isAdmin: false,
  isOfficeMember: true,
  operatorRole: "SIDE_MANAGER",
};
const plainMember: GoogleActorContext = {
  isAdmin: false,
  isOfficeMember: true,
  operatorRole: null,
};
const outsider: GoogleActorContext = {
  isAdmin: false,
  isOfficeMember: false,
  operatorRole: null,
};

const OPERATIONAL = [
  "GOOGLE_VIEW",
  "GOOGLE_REPLY_REVIEW",
  "GOOGLE_UPDATE_PROFILE",
  "GOOGLE_MANAGE_MEDIA",
  "GOOGLE_MANAGE_POSTS",
  "GOOGLE_VIEW_INSIGHTS",
] as const;

const ADMIN_ONLY = [
  "GOOGLE_CHANGE_PRIMARY",
  "GOOGLE_CONNECT",
  "GOOGLE_DISCONNECT",
  "GOOGLE_RECONNECT",
] as const;

describe("canGoogleOfficeAction", () => {
  it("grants admin every action", () => {
    for (const action of GOOGLE_ACTIONS) {
      expect(canGoogleOfficeAction(admin, action), action).toBe(true);
    }
  });

  it("gives PRIMARY the operational actions plus side-manager delegation", () => {
    for (const action of OPERATIONAL)
      expect(canGoogleOfficeAction(primary, action), action).toBe(true);
    expect(canGoogleOfficeAction(primary, "GOOGLE_ASSIGN_SIDE_MANAGER")).toBe(
      true,
    );
  });

  it("denies PRIMARY the admin-only actions", () => {
    for (const action of ADMIN_ONLY)
      expect(canGoogleOfficeAction(primary, action), action).toBe(false);
  });

  it("gives SIDE_MANAGER the operational actions only", () => {
    for (const action of OPERATIONAL)
      expect(canGoogleOfficeAction(side, action), action).toBe(true);
    expect(canGoogleOfficeAction(side, "GOOGLE_ASSIGN_SIDE_MANAGER")).toBe(
      false,
    );
    for (const action of ADMIN_ONLY)
      expect(canGoogleOfficeAction(side, action), action).toBe(false);
  });

  it("denies an office member with no operator role", () => {
    for (const action of GOOGLE_ACTIONS)
      expect(canGoogleOfficeAction(plainMember, action), action).toBe(false);
  });

  it("denies a non-member regardless of a stale operator role", () => {
    const stalePrimary: GoogleActorContext = {
      isAdmin: false,
      isOfficeMember: false,
      operatorRole: "PRIMARY",
    };
    for (const action of GOOGLE_ACTIONS)
      expect(canGoogleOfficeAction(stalePrimary, action), action).toBe(false);
  });

  it("denies an outsider every action", () => {
    for (const action of GOOGLE_ACTIONS)
      expect(canGoogleOfficeAction(outsider, action), action).toBe(false);
  });
});
