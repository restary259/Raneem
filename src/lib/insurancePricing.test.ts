import { describe, expect, it } from "vitest";
import {
  ageFromDob,
  computeInsuranceCost,
  matchAgeTier,
  monthsBetween,
  parseAgeTiers,
  resolveMonthlyRate,
} from "./insurancePricing";

const tiers = [
  { from_age: 0, to_age: 30, price: 68 },
  { from_age: 31, to_age: 45, price: 98 },
  { from_age: 46, to_age: null, price: 150 },
];

describe("parseAgeTiers", () => {
  it("normalises loose jsonb rows", () => {
    expect(parseAgeTiers([{ from_age: "0", to_age: "", price: "68" }])).toEqual([
      { from_age: 0, to_age: null, price: 68 },
    ]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(parseAgeTiers(null)).toEqual([]);
  });
});

describe("matchAgeTier", () => {
  it("picks the band containing the age", () => {
    expect(matchAgeTier(tiers, 35)?.price).toBe(98);
  });

  it("supports open-ended top bands", () => {
    expect(matchAgeTier(tiers, 70)?.price).toBe(150);
  });

  it("returns null when age is unknown", () => {
    expect(matchAgeTier(tiers, null)).toBeNull();
  });
});

describe("resolveMonthlyRate", () => {
  it("prefers the matched age band", () => {
    expect(resolveMonthlyRate({ price: 10, age_price_tiers: tiers }, 20)).toBe(68);
  });

  it("falls back to the base price when no band matches", () => {
    expect(resolveMonthlyRate({ price: 10, age_price_tiers: [] }, 20)).toBe(10);
  });

  it("returns null instead of zero when nothing is configured", () => {
    expect(resolveMonthlyRate({ price: 0, age_price_tiers: [] }, 20)).toBeNull();
  });
});

describe("monthsBetween", () => {
  it("counts whole months", () => {
    expect(monthsBetween("2026-01-01", "2026-07-01")).toBe(6);
  });

  it("rounds down partial months but never below 1", () => {
    expect(monthsBetween("2026-01-10", "2026-02-05")).toBe(1);
  });

  it("returns null without both dates", () => {
    expect(monthsBetween("2026-01-01", null)).toBeNull();
  });
});

describe("ageFromDob", () => {
  it("accounts for the birthday not having happened yet", () => {
    expect(ageFromDob("2000-12-31", new Date("2026-06-01"))).toBe(25);
    expect(ageFromDob("2000-01-01", new Date("2026-06-01"))).toBe(26);
  });
});

describe("computeInsuranceCost", () => {
  it("multiplies the band rate by the covered months", () => {
    const cost = computeInsuranceCost(
      { price: 0, billing_period: "monthly", age_price_tiers: tiers },
      35,
      "2026-01-01",
      "2026-05-01",
    );
    expect(cost.monthly).toBe(98);
    expect(cost.months).toBe(4);
    expect(cost.total).toBe(392);
  });

  it("keeps a one-off premium unmultiplied", () => {
    const cost = computeInsuranceCost(
      { price: 500, billing_period: "one_time", age_price_tiers: [] },
      35,
      "2026-01-01",
      "2026-05-01",
    );
    expect(cost.total).toBe(500);
  });

  it("reports null total when no price is configured", () => {
    expect(computeInsuranceCost({ price: 0, age_price_tiers: [] }, 20, "2026-01-01", "2026-05-01").total).toBeNull();
  });
});
