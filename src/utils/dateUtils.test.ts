import { describe, it, expect, vi, afterEach } from "vitest";
import { DOB_MONTHS, DOB_YEARS, normalizeDate, parseISODate, daysInMonth, ageFromISO } from "./dateUtils";

afterEach(() => {
  vi.useRealTimers();
});

describe("normalizeDate", () => {
  it("returns an ISO date and pads single digits", () => {
    expect(normalizeDate(5, 3, 1999)).toBe("1999-03-05");
    expect(normalizeDate("29", "2", "2024")).toBe("2024-02-29");
  });

  it("rejects dates that do not exist", () => {
    expect(() => normalizeDate(29, 2, 2023)).toThrow(/does not exist/);
    expect(() => normalizeDate(31, 4, 2020)).toThrow(/does not exist/);
  });

  it("rejects non-numeric and fractional fields", () => {
    expect(() => normalizeDate("abc", 1, 2000)).toThrow("Date fields must be numeric");
    expect(() => normalizeDate(1.5, 1, 2000)).toThrow("Date fields must be whole numbers");
  });

  it("rejects out-of-range components", () => {
    expect(() => normalizeDate(1, 13, 2000)).toThrow("Month must be between 1 and 12");
    expect(() => normalizeDate(32, 1, 2000)).toThrow("Day must be between 1 and 31");
    expect(() => normalizeDate(1, 1, 1899)).toThrow(/Year must be between 1900/);
    expect(() => normalizeDate(1, 1, new Date().getFullYear() + 1)).toThrow(/Year must be between 1900/);
  });
});

describe("parseISODate", () => {
  it("splits an ISO date into padded parts", () => {
    expect(parseISODate("2024-02-29")).toEqual({ day: "29", month: "02", year: "2024" });
  });

  it("returns empty parts for missing or malformed input", () => {
    expect(parseISODate(null)).toEqual({ day: "", month: "", year: "" });
    expect(parseISODate("29/02/2024")).toEqual({ day: "", month: "", year: "" });
  });
});

describe("daysInMonth", () => {
  it("handles leap years", () => {
    expect(daysInMonth(2, 2024)).toBe(29);
    expect(daysInMonth(2, 2023)).toBe(28);
  });

  it("returns the month length for other months", () => {
    expect(daysInMonth(4, 2024)).toBe(30);
    expect(daysInMonth(12, 2024)).toBe(31);
  });

  it("defaults to 31 while the form is incomplete", () => {
    expect(daysInMonth(0, 2024)).toBe(31);
    expect(daysInMonth(2, 0)).toBe(31);
  });
});

describe("ageFromISO", () => {
  it("counts whole years only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));
    expect(ageFromISO("2000-08-10")).toBe(26);
    expect(ageFromISO("2000-08-11")).toBe(25);
    expect(ageFromISO("2000-09-01")).toBe(25);
  });

  it("returns null for a missing date or a date in the future", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));
    expect(ageFromISO(null)).toBeNull();
    expect(ageFromISO("")).toBeNull();
    expect(ageFromISO("2030-01-01")).toBeNull();
  });
});

describe("date-picker option lists", () => {
  it("offers twelve months and years newest first", () => {
    expect(DOB_MONTHS).toHaveLength(12);
    expect(DOB_MONTHS[0]).toEqual({ v: "01", l: "January" });
    expect(DOB_YEARS[0]).toBe(2015);
    expect(DOB_YEARS[DOB_YEARS.length - 1]).toBe(1940);
  });
});
