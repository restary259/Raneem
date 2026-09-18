import { describe, it, expect } from "vitest";
import {
  levelsBetween,
  levelPlan,
  totalWeeks,
  quoteCourse,
  quoteAccommodation,
  summerWeeks,
  formatSchoolDate,
  partnerSchoolCatalogUrl,
  type CoursePriceTier,
  type AccommodationPriceTier,
} from "./partnerSchools";

const levels = [
  { level: "A1", weeks: 8, sort_order: 1 },
  { level: "A2", weeks: 8, sort_order: 2 },
  { level: "B1", weeks: 8, sort_order: 3 },
  { level: "B2", weeks: 12, sort_order: 4 },
  { level: "C1", weeks: 8, sort_order: 5 },
];

const courseTiers: CoursePriceTier[] = [
  { from_weeks: 1, to_weeks: 4, price_per_week: 210, kind: "booking" },
  { from_weeks: 5, to_weeks: 8, price_per_week: 190, kind: "booking" },
  { from_weeks: 9, to_weeks: 16, price_per_week: 180, kind: "booking" },
  { from_weeks: 17, to_weeks: 23, price_per_week: 170, kind: "booking" },
  { from_weeks: 24, to_weeks: null, price_per_week: 160, kind: "booking" },
];

const roomTiers: AccommodationPriceTier[] = [
  { from_weeks: 1, to_weeks: 1, total_price: 140, price_per_week: null },
  { from_weeks: 2, to_weeks: 2, total_price: 240, price_per_week: null },
  { from_weeks: 3, to_weeks: 3, total_price: 330, price_per_week: null },
  { from_weeks: 4, to_weeks: 4, total_price: 440, price_per_week: null },
  { from_weeks: 5, to_weeks: null, total_price: null, price_per_week: 110 },
];

describe("partnerSchools", () => {
  it("lists the levels a student still has to study", () => {
    expect(levelsBetween("A1", "B2")).toEqual(["A1", "A2", "B1", "B2"]);
    expect(levelsBetween("B2", "A1")).toEqual([]);
  });

  it("A1 → B2 is 36 weeks at the 24+ band", () => {
    const plan = levelPlan("A1", "B2", levels);
    expect(totalWeeks(plan)).toBe(36);
    const q = quoteCourse(courseTiers, 36);
    expect(q.pricePerWeek).toBe(160);
    expect(q.total).toBe(5760);
  });

  it("A1 → C1 is 44 weeks", () => {
    expect(totalWeeks(levelPlan("A1", "C1", levels))).toBe(44);
    const quote = quoteCourse(courseTiers, 44);
    expect(quote.pricePerWeek).toBe(160);
    expect(quote.total).toBe(7040);
  });

  it("short bookings use their own band", () => {
    expect(quoteCourse(courseTiers, 4).total).toBe(840);
    expect(quoteCourse(courseTiers, 8).total).toBe(1520);
  });

  it("flags missing level durations instead of guessing", () => {
    const plan = levelPlan("A1", "B1", [{ level: "A1", weeks: 8, sort_order: 1 }]);
    expect(plan.filter((p) => p.missing).map((p) => p.level)).toEqual(["A2", "B1"]);
  });

  it("prices accommodation from fixed totals then a weekly rate", () => {
    expect(quoteAccommodation(roomTiers, 1).total).toBe(140);
    expect(quoteAccommodation(roomTiers, 4).total).toBe(440);
    expect(quoteAccommodation(roomTiers, 13).total).toBe(1430);
  });

  it("counts only the weeks that fall inside the summer window", () => {
    expect(summerWeeks("2026-07-06", 4, "2026-07-06", "2026-08-28")).toBe(4);
    expect(summerWeeks("2026-01-05", 4, "2026-07-06", "2026-08-28")).toBe(0);
    expect(summerWeeks(null, 4, "2026-07-06", "2026-08-28")).toBe(0);
  });

  it("formats Arabic school dates with Arabic month names and Western digits", () => {
    expect(formatSchoolDate("2026-01-05", "ar")).toBe("5 يناير 2026");
  });

  it("builds a filtered catalog handoff without guessing a unit", () => {
    expect(partnerSchoolCatalogUrl({ schoolId: "school-1", roomType: "studio", meals: "none" }))
      .toBe("/team/catalog?school=school-1&tab=accommodations&roomType=studio&meals=self_catering");
    expect(partnerSchoolCatalogUrl({ schoolId: null, roomType: "studio", meals: "none" })).toBeNull();
  });
});
