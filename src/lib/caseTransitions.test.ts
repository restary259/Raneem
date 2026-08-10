import { describe, it, expect } from "vitest";
import { CaseStatus } from "./caseStatus";
import { ALLOWED_TRANSITIONS, canTransition, getNextSteps } from "./caseTransitions";

describe("canTransition", () => {
  it("allows the forward edges of the pipeline", () => {
    expect(canTransition(CaseStatus.NEW, CaseStatus.CONTACTED)).toBe(true);
    expect(canTransition(CaseStatus.PROFILE_COMPLETION, CaseStatus.PAYMENT_CONFIRMED)).toBe(true);
    expect(canTransition(CaseStatus.SUBMITTED, CaseStatus.ENROLLMENT_PAID)).toBe(true);
  });

  it("refuses to skip stages or move backwards", () => {
    expect(canTransition(CaseStatus.NEW, CaseStatus.PAYMENT_CONFIRMED)).toBe(false);
    expect(canTransition(CaseStatus.PAYMENT_CONFIRMED, CaseStatus.PROFILE_COMPLETION)).toBe(false);
  });

  it("allows re-engaging a forgotten case and re-scheduling an appointment", () => {
    expect(canTransition(CaseStatus.FORGOTTEN, CaseStatus.CONTACTED)).toBe(true);
    expect(canTransition(CaseStatus.APPT_SCHEDULED, CaseStatus.CONTACTED)).toBe(true);
    expect(canTransition(CaseStatus.APPT_SCHEDULED, CaseStatus.FORGOTTEN)).toBe(true);
  });

  it("leaves terminal states closed", () => {
    expect(canTransition(CaseStatus.ENROLLMENT_PAID, CaseStatus.SUBMITTED)).toBe(false);
    expect(canTransition(CaseStatus.CANCELLED, CaseStatus.CONTACTED)).toBe(false);
  });

  it("resolves unknown statuses instead of throwing", () => {
    expect(canTransition("not_a_status", CaseStatus.CONTACTED)).toBe(true);
    expect(canTransition(CaseStatus.NEW, "not_a_status")).toBe(false);
  });
});

describe("getNextSteps", () => {
  it("lists the allowed next statuses", () => {
    expect(getNextSteps(CaseStatus.APPT_SCHEDULED)).toEqual(
      ALLOWED_TRANSITIONS[CaseStatus.APPT_SCHEDULED],
    );
  });

  it("returns nothing for terminal statuses", () => {
    expect(getNextSteps(CaseStatus.ENROLLMENT_PAID)).toEqual([]);
    expect(getNextSteps(CaseStatus.CANCELLED)).toEqual([]);
  });
});
