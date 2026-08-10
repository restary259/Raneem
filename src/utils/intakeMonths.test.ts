import { describe, it, expect, vi, afterEach } from "vitest";
import { generateIntakeMonths, currentMonthValue } from "./intakeMonths";

afterEach(() => {
  vi.useRealTimers();
});

describe("generateIntakeMonths", () => {
  it("starts at the current Asia/Jerusalem month and walks forward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00Z"));
    const months = generateIntakeMonths(3);
    expect(months).toEqual([
      { value: "2026-03", label: "March 2026" },
      { value: "2026-04", label: "April 2026" },
      { value: "2026-05", label: "May 2026" },
    ]);
  });

  it("uses the Jerusalem calendar day, not UTC", () => {
    // 21:30 UTC on 31 March is already 1 April in Asia/Jerusalem (UTC+3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T21:30:00Z"));
    expect(generateIntakeMonths(1)[0].value).toBe("2026-04");
  });

  it("rolls the year over at the end of December", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-05T09:00:00Z"));
    expect(generateIntakeMonths(2)).toEqual([
      { value: "2026-12", label: "December 2026" },
      { value: "2027-01", label: "January 2027" },
    ]);
  });

  it("defaults to two years of options", () => {
    expect(generateIntakeMonths()).toHaveLength(24);
    expect(generateIntakeMonths(0)).toEqual([]);
  });
});

describe("currentMonthValue", () => {
  it("matches the first generated option", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    expect(currentMonthValue()).toBe("2026-07");
  });
});
