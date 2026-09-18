import { describe, it, expect } from "vitest";
import {
  levelsBetween,
  levelPlan,
  totalWeeks,
  quoteCourse,
  quoteAccommodation,
  summerWeeks,
  formatSchoolDate,
  localizeIncludedItem,
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
  { from_weeks: 1, to_weeks: 1, total_price: 290, price_per_week: null },
  { from_weeks: 2, to_weeks: 2, total_price: 390, price_per_week: null },
  { from_weeks: 3, to_weeks: 3, total_price: 525, price_per_week: null },
  { from_weeks: 4, to_weeks: 4, total_price: 660, price_per_week: null },
  { from_weeks: 5, to_weeks: null, total_price: null, price_per_week: 165 },
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

  it("quotes the featured 42-week course at the verified 24+ weekly rate", () => {
    const quote = quoteCourse(courseTiers, 42);
    expect(quote.pricePerWeek).toBe(160);
    expect(quote.total).toBe(6720);
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
    expect(quoteAccommodation(roomTiers, 1).total).toBe(290);
    expect(quoteAccommodation(roomTiers, 4).total).toBe(660);
    expect(quoteAccommodation(roomTiers, 13).total).toBe(2145);
  });

  it("counts only the weeks that fall inside the summer window", () => {
    expect(summerWeeks("2026-07-06", 4, "2026-07-06", "2026-08-28")).toBe(4);
    expect(summerWeeks("2026-01-05", 4, "2026-07-06", "2026-08-28")).toBe(0);
    expect(summerWeeks(null, 4, "2026-07-06", "2026-08-28")).toBe(0);
  });

  it("formats Arabic school dates with Arabic month names and Western digits", () => {
    expect(formatSchoolDate("2027-01-04", "ar")).toBe("4 يناير 2027");
  });

  it("localizes official included benefits in Arabic", () => {
    expect(localizeIncludedItem("10 hours of learning support and exam preparation per week", "ar"))
      .toBe("10 ساعات أسبوعياً للدعم التعليمي والتحضير للامتحانات");
    expect(localizeIncludedItem("Free Wi-Fi", "en")).toBe("Free Wi-Fi");
  });

  it("builds a filtered catalog handoff without guessing a unit", () => {
    expect(partnerSchoolCatalogUrl({ schoolId: "school-1", catalogIds: ["room-1"] }))
      .toBe("/team/catalog?school=school-1&tab=accommodations&ids=room-1");
    expect(partnerSchoolCatalogUrl({ schoolId: "school-1", catalogIds: ["room-1", "room-2"] }))
      .toBe("/team/catalog?school=school-1&tab=accommodations&ids=room-1%2Croom-2");
    expect(partnerSchoolCatalogUrl({ schoolId: null, catalogIds: ["room-1"] })).toBeNull();
  });

  it("does not link options with no catalog record", () => {
    expect(partnerSchoolCatalogUrl({ schoolId: "school-1", catalogIds: [] })).toBeNull();
    expect(partnerSchoolCatalogUrl({ schoolId: "school-1", catalogIds: null })).toBeNull();
  });
});

