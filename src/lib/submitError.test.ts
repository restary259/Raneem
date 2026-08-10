import { describe, it, expect } from "vitest";
import { submitBlockedMessage } from "./submitError";

const t = (key: string) => key;

describe("submitBlockedMessage", () => {
  it("maps each known SUBMIT_BLOCKED reason to its key", () => {
    const cases: Array<[string, string]> = [
      ["SUBMIT_BLOCKED: the case is not ready for team submission", "case.submit.blockedReasons.notReady"],
      ["SUBMIT_BLOCKED: the student file is missing", "case.submit.blockedReasons.missingFile"],
      ["SUBMIT_BLOCKED: the student profile must be complete first", "case.submit.blockedReasons.profileIncomplete"],
      ["SUBMIT_BLOCKED: school, course and start date are required", "case.submit.blockedReasons.schoolCourseRequired"],
      ["SUBMIT_BLOCKED: select at least one DARB service before submitting", "case.submit.blockedReasons.noServices"],
      ["SUBMIT_BLOCKED: DARB service payment must be confirmed by the assigned team member", "case.submit.blockedReasons.paymentNotConfirmed"],
    ];
    for (const [raw, expected] of cases) {
      expect(submitBlockedMessage(new Error(raw), t)).toBe(expected);
    }
  });

  it("falls back to the generic blocked message for an unknown reason", () => {
    expect(submitBlockedMessage(new Error("SUBMIT_BLOCKED: something exotic"), t)).toBe(
      "case.submit.blocked",
    );
  });

  it("returns null for errors that are not SUBMIT_BLOCKED", () => {
    expect(submitBlockedMessage(new Error("Case not found"), t)).toBeNull();
    expect(submitBlockedMessage(null, t)).toBeNull();
  });
});
