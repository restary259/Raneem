import { describe, it, expect } from "vitest";
import {
  filterActiveInvitations,
  normalizeEmail,
  type PendingInvitation,
  type ActiveStudent,
} from "./studentInvitations";

const inv = (id: string, email: string) => ({
  id,
  invited_email: email,
  invited_name: null,
  status: "pending",
  expires_at: "2026-12-31T00:00:00Z",
  created_at: "2026-08-13T00:00:00Z",
  case_id: null,
});

const student = (id: string, email: string): ActiveStudent => ({ id, email });

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com");
  });
  it("handles null/undefined", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("filterActiveInvitations", () => {
  it("keeps invitations with no matching active student", () => {
    const invitations = [inv("1", "pending@example.com")];
    const students = [student("u1", "active@example.com")];
    expect(filterActiveInvitations(invitations, students)).toEqual(invitations);
  });

  it("hides an invitation whose email matches an active student (case-insensitive)", () => {
    const invitations = [
      inv("1", "Pending@Example.com"),
      inv("2", "other@example.com"),
    ];
    const students = [student("u1", "pending@example.com")];
    expect(filterActiveInvitations(invitations, students)).toEqual([
      inv("2", "other@example.com"),
    ]);
  });

  it("trims whitespace before comparing", () => {
    const invitations = [inv("1", "  student@example.com  ")];
    const students = [student("u1", "student@example.com")];
    expect(filterActiveInvitations(invitations, students)).toEqual([]);
  });

  it("hides every matching invitation when there are duplicates", () => {
    const invitations = [
      inv("1", "dup@example.com"),
      inv("2", "dup@example.com"),
      inv("3", "kept@example.com"),
    ];
    const students = [student("u1", "DUP@example.com")];
    expect(filterActiveInvitations(invitations, students)).toEqual([
      inv("3", "kept@example.com"),
    ]);
  });

  it("returns all invitations when there are no active students", () => {
    const invitations = [inv("1", "a@example.com"), inv("2", "b@example.com")];
    expect(filterActiveInvitations(invitations, [])).toEqual(invitations);
  });

  it("returns an empty array when there are no invitations", () => {
    expect(filterActiveInvitations([], [student("u1", "a@example.com")])).toEqual([]);
  });

  it("keeps invitations with a blank invited_email (cannot be correlated)", () => {
    const invitations = [inv("1", "")];
    const students = [student("u1", "active@example.com")];
    expect(filterActiveInvitations(invitations, students)).toEqual(invitations);
  });

  it("ignores active students with a blank email", () => {
    const invitations = [inv("1", "real@example.com")];
    const students = [student("u1", "")];
    expect(filterActiveInvitations(invitations, students)).toEqual(invitations);
  });
});
