import { describe, it, expect } from "vitest";
import { CURRENCY, CURRENCY_SYMBOL, formatILS, formatILSPrecise } from "./money";

describe("formatILS", () => {
  it("puts the shekel symbol first and groups thousands", () => {
    expect(formatILS(12500)).toBe("₪ 12,500");
    expect(formatILS(0)).toBe("₪ 0");
    expect(formatILS(-1500)).toBe("₪ -1,500");
  });

  it("rounds to whole shekels", () => {
    expect(formatILS(4000.4)).toBe("₪ 4,000");
    expect(formatILS(4000.5)).toBe("₪ 4,001");
  });

  it("treats missing and non-finite amounts as zero", () => {
    expect(formatILS(null)).toBe("₪ 0");
    expect(formatILS(undefined)).toBe("₪ 0");
    expect(formatILS(Number.NaN)).toBe("₪ 0");
    expect(formatILS(Number.POSITIVE_INFINITY)).toBe("₪ 0");
  });
});

describe("formatILSPrecise", () => {
  it("always shows two decimals", () => {
    expect(formatILSPrecise(12500)).toBe("₪ 12,500.00");
    expect(formatILSPrecise(12500.5)).toBe("₪ 12,500.50");
    expect(formatILSPrecise(0.125)).toBe("₪ 0.13");
  });

  it("treats missing amounts as zero", () => {
    expect(formatILSPrecise(null)).toBe("₪ 0.00");
    expect(formatILSPrecise(Number.NaN)).toBe("₪ 0.00");
  });
});

describe("currency constants", () => {
  it("exposes ILS as the only currency", () => {
    expect(CURRENCY).toBe("ILS");
    expect(CURRENCY_SYMBOL).toBe("₪");
  });
});
