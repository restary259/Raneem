import { describe, it, expect } from "vitest";
import {
  parseWeekTiers,
  resolveWeeklyRate,
  computeWeeklyCost,
  weeksBetween,
  endDateForWeeks,
} from "./programPricing";

const program = {
  price: 210,
  currency: "EUR",
  price_tiers: [
    { from_weeks: 1, price: 210, to_weeks: 3 },
    { from_weeks: 4, price: 185, to_weeks: 23 },
    { from_weeks: 24, price: 160, to_weeks: null },
  ],
};

describe("programPricing", () => {
  it("parses tiers and drops priceless rows", () => {
    expect(parseWeekTiers(program.price_tiers)).toHaveLength(3);
    expect(parseWeekTiers([{ from_weeks: 1 }])).toHaveLength(0);
    expect(parseWeekTiers(null)).toEqual([]);
  });

  it("picks the tier matching the stay length", () => {
    expect(resolveWeeklyRate(program, 2)).toBe(210);
    expect(resolveWeeklyRate(program, 10)).toBe(185);
    expect(resolveWeeklyRate(program, 40)).toBe(160);
  });

  it("falls back to the base weekly price", () => {
    expect(resolveWeeklyRate({ price: 190, price_tiers: [] }, 40)).toBe(190);
    expect(resolveWeeklyRate({ price: null, price_tiers: [] }, 40)).toBeNull();
  });

  it("multiplies the weekly rate by the number of weeks", () => {
    const cost = computeWeeklyCost(program, 40);
    expect(cost).toMatchObject({ weeks: 40, weeklyRate: 160, total: 6400, currency: "EUR" });
    expect(computeWeeklyCost(program, 0).total).toBe(0);
  });

  it("derives weeks and end dates", () => {
    expect(weeksBetween("2026-01-01", "2026-01-29")).toBe(4);
    expect(weeksBetween("2026-01-01", null)).toBeNull();
    expect(endDateForWeeks("2026-01-01", 4)).toBe("2026-01-29");
    expect(endDateForWeeks(null, 4)).toBeNull();
  });
});
