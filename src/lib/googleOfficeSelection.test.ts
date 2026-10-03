import { describe, it, expect } from "vitest";
import { resolveGooglePageOffice } from "./googleOfficeSelection";

const A = "office-a";
const B = "office-b";

describe("resolveGooglePageOffice", () => {
  it("uses the workspace office when the operator has access to it", () => {
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: true,
        effectiveOfficeId: A,
        officeIds: [A, B],
        current: null,
      }),
    ).toBe(A);
  });

  it("does not rebind to another office when the workspace office is not accessible", () => {
    // Operator belongs to office A but only has Google access for office B,
    // and opens the canonical A Google page. It must NOT silently operate B.
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: true,
        effectiveOfficeId: A,
        officeIds: [B],
        current: null,
      }),
    ).toBeNull();
  });

  it("ignores an unrelated current selection while in the workspace", () => {
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: true,
        effectiveOfficeId: A,
        officeIds: [A, B],
        current: B,
      }),
    ).toBe(A);
  });

  it("keeps the cross-office fallback: current, then effective, then first", () => {
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: false,
        effectiveOfficeId: B,
        officeIds: [A, B],
        current: B,
      }),
    ).toBe(B);
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: false,
        effectiveOfficeId: B,
        officeIds: [A, B],
        current: null,
      }),
    ).toBe(B);
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: false,
        effectiveOfficeId: null,
        officeIds: [A, B],
        current: null,
      }),
    ).toBe(A);
  });

  it("returns null when there are no offices at all", () => {
    expect(
      resolveGooglePageOffice({
        inOfficeWorkspace: false,
        effectiveOfficeId: null,
        officeIds: [],
        current: null,
      }),
    ).toBeNull();
  });
});
