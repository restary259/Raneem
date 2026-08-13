import { describe, it, expect } from "vitest";
import { discountAppliedFromCase } from "./referralDiscount";

describe("discountAppliedFromCase", () => {
  it("is true for a positive number", () => {
    expect(discountAppliedFromCase(500)).toBe(true);
    expect(discountAppliedFromCase(0.01)).toBe(true);
  });

  it("is false for zero", () => {
    expect(discountAppliedFromCase(0)).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(discountAppliedFromCase(null)).toBe(false);
    expect(discountAppliedFromCase(undefined)).toBe(false);
  });

  it("is false for negative (should never happen, but guarded)", () => {
    expect(discountAppliedFromCase(-100)).toBe(false);
  });

  it("parses a numeric string", () => {
    expect(discountAppliedFromCase("500")).toBe(true);
    expect(discountAppliedFromCase("0")).toBe(false);
  });

  it("is false for a non-finite value", () => {
    expect(discountAppliedFromCase(NaN)).toBe(false);
    expect(discountAppliedFromCase(Infinity)).toBe(false);
    expect(discountAppliedFromCase("abc")).toBe(false);
  });
});
