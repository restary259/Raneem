import { describe, it, expect } from "vitest";
import { VISA_INFO_STEPS, validateStep, completedSteps, isLocked } from "./visaInfoSchema";

const step = (id: string) => VISA_INFO_STEPS.find((s) => s.id === id)!;

describe("visaInfoSchema", () => {
  it("family step is fully optional", () => {
    expect(validateStep(step("family"), {})).toEqual({});
  });
  it("height and eye colour are optional but height must be realistic", () => {
    const base = { first_names: "A", surname: "B", date_of_birth: "2000-01-01", place_of_birth: "x", country_of_birth: "x",
      sex: "male", marital_status: "single", nationality: "x", has_children: "no" };
    expect(validateStep(step("personal"), base)).toEqual({});
    expect(validateStep(step("personal"), { ...base, height_cm: "40" }).height_cm).toBe("invalidHeight");
  });
  it("explanation only required when answer is yes", () => {
    const s = { convicted: "no", deported: "no", permit_rejected: "no", entry_refused: "no" };
    expect(validateStep(step("background"), s)).toEqual({});
    expect(validateStep(step("background"), { ...s, convicted: "yes" }).convicted_details).toBe("required");
  });
  it("passport expiry must follow issue date", () => {
    const e = validateStep(step("passport"), { document_type: "passport", passport_number: "AB12345",
      issue_date: "2025-01-01", expiry_date: "2024-01-01", issuing_country: "IL" });
    expect(e.expiry_date).toBe("expiryBeforeIssue");
  });
  it("arrival cannot be in the past", () => {
    expect(validateStep(step("travel"), { arrival_date: "2020-01-01" }, "2026-10-06").arrival_date).toBe("pastArrival");
  });
  it("counts completed steps and lock states", () => {
    expect(completedSteps({ family: { father_surname: "x" } })).toBe(1);
    expect(isLocked("submitted")).toBe(true);
    expect(isLocked("needs_correction")).toBe(false);
  });
});
