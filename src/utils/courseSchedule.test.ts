import { describe, expect, it } from "vitest";
import { calculateCourseEndDate, formatCourseDate, retainOfficialStartDate } from "./courseSchedule";

describe("calculateCourseEndDate", () => {
  it("ends a one-week Monday course on Friday", () => {
    expect(calculateCourseEndDate("2026-10-26", 1)).toBe("2026-10-30");
  });

  it("calculates Jilan's 34-week HORIZONTE schedule", () => {
    expect(calculateCourseEndDate("2026-10-26", 34)).toBe("2027-06-18");
  });

  it("handles a Tuesday holiday start and still ends on Friday", () => {
    expect(calculateCourseEndDate("2028-01-04", 1)).toBe("2028-01-07");
  });

  it("crosses leap years and year boundaries with UTC-safe arithmetic", () => {
    expect(calculateCourseEndDate("2027-12-27", 10)).toBe("2028-03-03");
  });

  it("returns null for missing, malformed, impossible, or non-whole inputs", () => {
    expect(calculateCourseEndDate("", 34)).toBeNull();
    expect(calculateCourseEndDate("2026-02-30", 34)).toBeNull();
    expect(calculateCourseEndDate("2026-10-26", 0)).toBeNull();
    expect(calculateCourseEndDate("2026-10-26", 2.5)).toBeNull();
  });
});

describe("official date selection", () => {
  it("keeps only dates published for the newly selected school", () => {
    expect(retainOfficialStartDate("2026-10-26", ["2026-10-12", "2026-10-26"])).toBe("2026-10-26");
    expect(retainOfficialStartDate("2026-10-26", ["2026-11-02"])).toBe("");
  });

  it("formats dates with ASCII digits", () => {
    expect(formatCourseDate("2026-10-26")).toBe("Oct 26, 2026");
  });
});